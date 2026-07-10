import logging
from typing import List, Dict, Any, AsyncGenerator
import httpx
from fastapi import HTTPException
from app.services.provider import PhotoProvider

logger = logging.getLogger("wikimedia_commons_bridge.google_picker")

class GooglePhotosPickerProvider(PhotoProvider):
    """Google Photos Picker API implementation of PhotoProvider."""
    
    BASE_URL = "https://photospicker.googleapis.com/v1"

    async def create_picker_session(self, access_token: str) -> Dict[str, Any]:
        """Create a new Google Photos picker session."""
        url = f"{self.BASE_URL}/sessions"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json={})
                if response.status_code != 200:
                    logger.error(f"Failed to create Google Photos Picker session: {response.text}")
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail=f"Google Picker API error: {response.text}"
                    )
                
                data = response.json()
                picker_uri = data.get("pickerUri")
                # Append autoclose to pickerUri for web redirect popup UX
                if picker_uri and not picker_uri.endswith("/autoclose"):
                    picker_uri = f"{picker_uri}/autoclose"
                    
                return {
                    "session_id": data.get("id"),
                    "picker_uri": picker_uri
                }
            except httpx.RequestError as exc:
                logger.error(f"HTTP request failed: {exc}")
                raise HTTPException(status_code=500, detail=f"Failed to connect to Google API: {exc}")

    async def poll_picker_session(self, access_token: str, session_id: str) -> bool:
        """Poll the Google Photos Picker session to check if user completed picking."""
        url = f"{self.BASE_URL}/sessions/{session_id}"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code != 200:
                    logger.error(f"Failed to poll session {session_id}: {response.text}")
                    return False
                
                data = response.json()
                # mediaItemsSet is True when selection is finalized
                return data.get("mediaItemsSet", False)
            except httpx.RequestError as exc:
                logger.error(f"HTTP request failed during poll: {exc}")
                return False

    async def get_picked_media_items(self, access_token: str, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve details of user-picked media items from Google Photos."""
        url = f"{self.BASE_URL}/mediaItems"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        params = {
            "sessionId": session_id
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code != 200:
                    logger.error(f"Failed to list media items for session {session_id}: {response.text}")
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail=f"Failed to retrieve selected media: {response.text}"
                    )
                
                data = response.json()
                media_items = data.get("mediaItems", [])
                
                # Normalize response keys to match generic interface
                normalized_items = []
                for item in media_items:
                    normalized_items.append({
                        "id": item.get("id"),
                        "filename": item.get("filename"),
                        "mime_type": item.get("mimeType"),
                        "creation_time": item.get("creationTime"),
                        "width": int(item.get("width", 0)),
                        "height": int(item.get("height", 0)),
                        "base_url": item.get("baseUrl")
                    })
                return normalized_items
            except httpx.RequestError as exc:
                logger.error(f"HTTP request failed during retrieval: {exc}")
                raise HTTPException(status_code=500, detail=f"Failed to connect to Google API: {exc}")

    async def delete_picker_session(self, access_token: str, session_id: str) -> bool:
        """Delete/cleanup the Picker Session resource on Google side."""
        url = f"{self.BASE_URL}/sessions/{session_id}"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(url, headers=headers)
                if response.status_code != 200:
                    logger.warning(f"Failed to delete session {session_id} on Google side: {response.text}")
                    return False
                return True
            except httpx.RequestError as exc:
                logger.warning(f"Failed to request session deletion for {session_id}: {exc}")
                return False

    async def stream_media_bytes(self, access_token: str, media_url: str) -> AsyncGenerator[bytes, None]:
        """
        Stream high-resolution image bytes.
        Google Photos base_url does not require authorization header and lasts 60 minutes.
        We append '=d' to baseUrl to get the original/download quality.
        """
        # Append download flag to request original size
        download_url = f"{media_url}=d" if not media_url.endswith("=d") else media_url
        
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", download_url, timeout=60.0) as response:
                if response.status_code != 200:
                    logger.error(f"Failed to stream media from Google Photos URL: {response.status_code}")
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail="Failed to stream media bytes from Google Photos"
                    )
                
                async for chunk in response.iter_bytes(chunk_size=1024 * 1024):  # 1MB chunks
                    yield chunk

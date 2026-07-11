import logging
from typing import Dict, Any, Callable, Awaitable, Optional
import httpx
from fastapi import HTTPException

logger = logging.getLogger("wikimedia_commons_bridge.mediawiki")

COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "WikimediaCommonsBridge/1.0 (https://github.com/anu/wikimedia-commons-bridge; mailto:info@covai.org)"
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB chunks

async def get_csrf_token(client: httpx.AsyncClient, access_token: str) -> str:
    """Retrieve a CSRF token required for editing and uploading to Wikimedia Commons."""
    params = {
        "action": "query",
        "meta": "tokens",
        "type": "csrf",
        "format": "json"
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "User-Agent": USER_AGENT
    }
    
    resp = await client.get(COMMONS_API_URL, params=params, headers=headers)
    if resp.status_code != 200:
        logger.error(f"Failed to fetch CSRF token: {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch CSRF token from Commons API")
        
    data = resp.json()
    token = data.get("query", {}).get("tokens", {}).get("csrftoken")
    if not token:
        logger.error(f"CSRF token missing in response: {data}")
        raise HTTPException(status_code=400, detail="CSRF token missing in Commons response")
        
    return token

async def upload_file_in_chunks(
    wikimedia_token: str,
    google_token: str,
    media_url: str,
    commons_filename: str,
    wikitext: str,
    on_progress: Optional[Callable[[int, int], Awaitable[None]]] = None
) -> Dict[str, Any]:
    """
    Download a file from Google Photos and upload it to Wikimedia Commons in chunks.
    Pipes bytes directly in-memory without saving local files.
    """
    google_headers = {
        "User-Agent": USER_AGENT,
        "Authorization": f"Bearer {google_token}"
    }
    
    # Request the original quality image from Google
    download_url = f"{media_url}=d" if not media_url.endswith("=d") else media_url
    
    async with httpx.AsyncClient() as client:
        # 1. Fetch file size and initiate stream from Google
        try:
            google_resp = await client.get(download_url, headers=google_headers, timeout=60.0)
            if google_resp.status_code != 200:
                logger.error(f"Failed to fetch media from Google: {google_resp.status_code}")
                raise HTTPException(status_code=google_resp.status_code, detail="Failed to retrieve photo bytes from Google Photos")
            
            # Content-Length is sent by Google static servers
            total_size_str = google_resp.headers.get("Content-Length")
            total_size = int(total_size_str) if total_size_str else 0
            
            file_bytes = google_resp.content
            if total_size == 0:
                total_size = len(file_bytes)
                
            logger.info(f"Uploading file '{commons_filename}' (Size: {total_size} bytes) in chunks...")
        except httpx.RequestError as exc:
            logger.error(f"Connection error downloading from Google: {exc}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to Google Photos server: {exc}")

        # 2. Get CSRF Token from MediaWiki
        csrf_token = await get_csrf_token(client, wikimedia_token)
        
        # 3. Perform chunked uploads
        filekey = None
        offset = 0
        
        mw_headers = {
            "Authorization": f"Bearer {wikimedia_token}",
            "User-Agent": USER_AGENT
        }
        
        while offset < total_size:
            chunk_data = file_bytes[offset : offset + CHUNK_SIZE]
            current_chunk_size = len(chunk_data)
            
            # Prepare multipart payload
            files = {
                "chunk": (commons_filename, chunk_data, "application/octet-stream")
            }
            
            data = {
                "action": "upload",
                "format": "json",
                "filename": commons_filename,
                "token": csrf_token,
                "offset": str(offset),
                "filesize": str(total_size),
                "stash": "1"
            }
            
            if filekey:
                data["filekey"] = filekey

            try:
                # Upload current chunk
                logger.info(f"Uploading chunk: offset={offset}, size={current_chunk_size}")
                response = await client.post(COMMONS_API_URL, data=data, files=files, headers=mw_headers, timeout=60.0)
                if response.status_code != 200:
                    logger.error(f"Upload chunk failed with HTTP status {response.status_code}: {response.text}")
                    raise HTTPException(status_code=response.status_code, detail=f"Wikimedia chunk upload failed: {response.text}")
                
                resp_json = response.json()
                upload_info = resp_json.get("upload", {})
                
                # Check for errors in MediaWiki payload
                if "error" in resp_json:
                    err = resp_json["error"]
                    logger.error(f"Wikimedia API error during chunk upload: {err}")
                    raise HTTPException(status_code=400, detail=f"Wikimedia API error: {err.get('info')}")

                result = upload_info.get("result")
                filekey = upload_info.get("filekey")
                
                if result != "Continue" and offset + current_chunk_size < total_size:
                    logger.error(f"Unexpected upload result status: {result} for stashed chunk.")
                    raise HTTPException(status_code=400, detail=f"Wikimedia upload failed with status: {result}")
                
                offset += current_chunk_size
                
                # Trigger progress callback if set
                if on_progress:
                    await on_progress(offset, total_size)
                    
            except httpx.RequestError as exc:
                logger.error(f"Connection error uploading chunk to Wikimedia: {exc}")
                raise HTTPException(status_code=500, detail=f"Wikimedia connection error: {exc}")

        # 4. Finalize/Commit the stashed file
        if not filekey:
            raise HTTPException(status_code=400, detail="Stashed filekey missing after complete upload.")
            
        commit_data = {
            "action": "upload",
            "format": "json",
            "filename": commons_filename,
            "token": csrf_token,
            "filekey": filekey,
            "text": wikitext,
            "comment": "Transferred from Google Photos via Commons Bridge"
        }
        
        try:
            logger.info(f"Finalizing upload commit for file '{commons_filename}'...")
            commit_resp = await client.post(COMMONS_API_URL, data=commit_data, headers=mw_headers, timeout=30.0)
            if commit_resp.status_code != 200:
                logger.error(f"Failed to commit upload: {commit_resp.text}")
                raise HTTPException(status_code=commit_resp.status_code, detail="Failed to finalize upload on Wikimedia Commons")
                
            commit_json = commit_resp.json()
            if "error" in commit_json:
                err = commit_json["error"]
                logger.error(f"Wikimedia commit API error: {err}")
                raise HTTPException(status_code=400, detail=f"Failed to publish image: {err.get('info')}")
                
            upload_result = commit_json.get("upload", {})
            if upload_result.get("result") == "Success":
                imageinfo = upload_result.get("imageinfo", {})
                logger.info(f"Upload completed successfully for file: {commons_filename}")
                return {
                    "status": "success",
                    "filename": upload_result.get("filename"),
                    "description_url": imageinfo.get("descriptionurl"),
                    "url": imageinfo.get("url")
                }
            else:
                logger.error(f"Unexpected finalize result: {upload_result}")
                raise HTTPException(status_code=400, detail=f"Upload publication failed: {upload_result.get('result')}")
                
        except httpx.RequestError as exc:
            logger.error(f"Connection error during finalize commit: {exc}")
            raise HTTPException(status_code=500, detail=f"Connection failure during upload publish: {exc}")

async def get_user_rate_limits(access_token: str) -> Dict[str, Any]:
    """
    Query the MediaWiki API for the current authenticated user's rate limits.
    Helps prevent account locks or 429 errors from standard upload limits.
    """
    params = {
        "action": "query",
        "meta": "userinfo",
        "uiprop": "ratelimits",
        "format": "json"
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "User-Agent": USER_AGENT
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(COMMONS_API_URL, params=params, headers=headers)
            if resp.status_code != 200:
                logger.warning(f"Failed to query rate limits: {resp.text}")
                return {}
            data = resp.json()
            return data.get("query", {}).get("userinfo", {}).get("ratelimits", {})
        except httpx.RequestError as exc:
            logger.warning(f"Connection failure checking user rate limits: {exc}")
            return {}


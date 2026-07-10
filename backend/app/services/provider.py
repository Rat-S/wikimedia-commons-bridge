from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator

class PhotoProvider(ABC):
    """Abstract Base Class defining the interface for all external photo sources."""

    @abstractmethod
    async def create_picker_session(self, access_token: str) -> Dict[str, Any]:
        """
        Initialize a picking session with the photo provider.
        Returns a dict containing:
          - session_id: Unique identifier for the created session
          - picker_uri: The URI to redirect the user to for photo selection
        """
        pass

    @abstractmethod
    async def poll_picker_session(self, access_token: str, session_id: str) -> bool:
        """
        Check if the user has completed photo selection for the session.
        Returns True if selection is complete, False otherwise.
        """
        pass

    @abstractmethod
    async def get_picked_media_items(self, access_token: str, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve list of media items selected by the user in this session.
        Returns list of dicts, each containing:
          - id: Unique media item identifier
          - filename: Original filename
          - mime_type: MIME type
          - creation_time: Timestamp of creation
          - width: Width in pixels
          - height: Height in pixels
          - base_url: Temporary URL to retrieve the image bytes/thumbnails
        """
        pass

    @abstractmethod
    async def delete_picker_session(self, access_token: str, session_id: str) -> bool:
        """
        Clean up and delete the session resource on the provider side.
        Returns True if successful.
        """
        pass

    @abstractmethod
    async def stream_media_bytes(self, access_token: str, media_url: str) -> AsyncGenerator[bytes, None]:
        """
        Stream full-resolution image bytes from the provider's temporary URL.
        Yields bytes chunks.
        """
        pass

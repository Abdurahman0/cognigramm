from uuid import uuid4

import boto3
from botocore.client import BaseClient

from app.config import Settings


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: BaseClient = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def generate_presigned_upload(
        self,
        user_id: int,
        filename: str,
        content_type: str,
        size_bytes: int,
    ) -> dict[str, str | int]:
        object_key = f"u/{user_id}/{uuid4()}-{filename}"
        url = self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.settings.s3_bucket_name,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=self.settings.s3_presign_expire_seconds,
        )
        public_url = None
        if self.settings.s3_endpoint_url:
            public_url = (
                f"{self.settings.s3_endpoint_url.rstrip('/')}/{self.settings.s3_bucket_name}/{object_key}"
            )
        return {
            "upload_url": url,
            "bucket": self.settings.s3_bucket_name,
            "object_key": object_key,
            "expires_in": self.settings.s3_presign_expire_seconds,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "public_url": public_url or "",
        }

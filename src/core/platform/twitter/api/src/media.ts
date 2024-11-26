export class MediaUploader {
  constructor(private headers: () => Promise<Record<string, string>>) {}

  async uploadMedia(data: Buffer, mediaType: string) {
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const headers = await this.headers();

    // Remove content-type from headers as FormData will set it
    const { "content-type": _, ...uploadHeaders } = headers;

    if (mediaType.startsWith("video/")) {
      return this.uploadVideoInChunks(
        data,
        mediaType,
        uploadUrl,
        uploadHeaders
      );
    } else {
      return this.uploadImage(data, mediaType, uploadUrl, uploadHeaders);
    }
  }

  private async uploadImage(
    data: Buffer,
    mediaType: string,
    uploadUrl: string,
    headers: Record<string, string>
  ) {
    const form = new FormData();
    form.append("media_category", "tweet_image");
    form.append("media", new Blob([data], { type: mediaType }), "media.jpg");

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...headers,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload image: ${errorText}`);
    }

    const result = await response.json();
    return { mediaId: result.media_id_string };
  }

  private async uploadVideoInChunks(
    data: Buffer,
    mediaType: string,
    uploadUrl: string,
    headers: Record<string, string>
  ) {
    // INIT phase
    const initForm = new FormData();
    initForm.append("command", "INIT");
    initForm.append("media_type", mediaType);
    initForm.append("media_category", "tweet_video");
    initForm.append("total_bytes", data.length.toString());

    const initResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...headers,
      },
      body: initForm,
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error("INIT failed:", errorText);
      throw new Error(`Failed to initialize video upload: ${errorText}`);
    }

    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;

    // APPEND phase
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    let segmentIndex = 0;
    const totalChunks = Math.ceil(data.length / chunkSize);

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);

      const appendForm = new FormData();
      appendForm.append("command", "APPEND");
      appendForm.append("media_id", mediaId);
      appendForm.append("segment_index", segmentIndex.toString());
      appendForm.append("media", new Blob([chunk], { type: mediaType }));

      const appendResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          ...headers,
        },
        body: appendForm,
      });

      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        console.error("APPEND failed:", errorText);
        throw new Error(`Failed to append video chunk: ${errorText}`);
      }

      segmentIndex++;
    }

    // FINALIZE phase
    const finalizeForm = new FormData();
    finalizeForm.append("command", "FINALIZE");
    finalizeForm.append("media_id", mediaId);

    const finalizeResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...headers,
      },
      body: finalizeForm,
    });

    if (!finalizeResponse.ok) {
      const errorText = await finalizeResponse.text();
      console.error("FINALIZE failed:", errorText);
      throw new Error(`Failed to finalize video upload: ${errorText}`);
    }

    // Check processing status
    await this.checkMediaStatus(mediaId, uploadUrl, headers);

    return { mediaId };
  }

  private async checkMediaStatus(
    mediaId: string,
    uploadUrl: string,
    headers: Record<string, string>
  ) {
    let processing = true;
    while (processing) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create URL with parameters instead of using FormData
      const statusUrl = new URL(uploadUrl);
      statusUrl.searchParams.append("command", "STATUS");
      statusUrl.searchParams.append("media_id", mediaId);

      const response = await fetch(statusUrl.toString(), {
        method: "GET",
        headers: {
          ...headers,
          "content-type": "application/x-www-form-urlencoded",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const headerObj: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headerObj[key] = value;
        });

        console.error("Status check failed:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: headerObj,
        });
        throw new Error(`Failed to check media status: ${errorText}`);
      }

      const status = await response.json();

      if (status.processing_info?.state === "succeeded") {
        processing = false;
      } else if (status.processing_info?.state === "failed") {
        throw new Error(
          `Media processing failed: ${JSON.stringify(status.processing_info)}`
        );
      } else if (!status.processing_info) {
        // If there's no processing_info, assume it's done
        processing = false;
      }

      // Add timeout to prevent infinite loops
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

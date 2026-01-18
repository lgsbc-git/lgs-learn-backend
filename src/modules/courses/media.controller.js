const { uploadToBlob, generateUniqueBlobName } = require("../../config/blob");

/**
 * Upload media (image/video) to Azure Blob Storage
 */
const uploadChapterMedia = async (req, res) => {
  try {
    const { courseId, chapterId } = req.params;
    const { file } = req;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    if (!courseId || !chapterId) {
      return res
        .status(400)
        .json({ message: "Course ID and Chapter ID are required" });
    }

    // Validate file type (images and videos)
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        message: `File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, MP4, WebM, MOV`,
      });
    }

    // Check file size (max 500MB)
    const maxFileSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxFileSize) {
      return res.status(400).json({
        message: "File size exceeds 500MB limit",
      });
    }

    // Generate unique blob name
    const blobName = generateUniqueBlobName(
      file.originalname,
      courseId,
      chapterId
    );

    // Upload to Azure Blob Storage
    const blobUrl = await uploadToBlob(blobName, file.buffer, file.mimetype);

    return res.status(200).json({
      message: "File uploaded successfully",
      url: blobUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      blobName,
    });
  } catch (error) {
    console.error("❌ Media upload failed:", error.message);
    return res.status(500).json({
      message: "Failed to upload media",
      error: error.message,
    });
  }
};

module.exports = {
  uploadChapterMedia,
};

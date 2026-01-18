const { BlobServiceClient } = require("@azure/storage-blob");
const env = require("./env");

let blobServiceClient = null;

const initBlobService = () => {
  try {
    if (!env.azure.connectionString) {
      throw new Error("Azure connection string is not configured");
    }

    blobServiceClient = BlobServiceClient.fromConnectionString(
      env.azure.connectionString
    );

    console.log("✅ Azure Blob Storage initialized successfully");
    return blobServiceClient;
  } catch (error) {
    console.error("❌ Failed to initialize Azure Blob Storage:", error.message);
    throw error;
  }
};

const getBlobServiceClient = () => {
  if (!blobServiceClient) {
    return initBlobService();
  }
  return blobServiceClient;
};

const uploadToBlob = async (fileName, fileBuffer, mimeType) => {
  try {
    const client = getBlobServiceClient();
    const containerClient = client.getContainerClient(env.azure.containerName);

    // Ensure container exists
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error("❌ Blob upload failed:", error.message);
    throw new Error(`Failed to upload file to Azure Blob: ${error.message}`);
  }
};

const deleteFromBlob = async (fileName) => {
  try {
    const client = getBlobServiceClient();
    const containerClient = client.getContainerClient(env.azure.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.delete();
    return true;
  } catch (error) {
    console.error("❌ Blob deletion failed:", error.message);
    throw new Error(`Failed to delete file from Azure Blob: ${error.message}`);
  }
};

const generateUniqueBlobName = (originalFileName, courseId, chapterId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const fileExtension = originalFileName.split(".").pop();

  return `courses/${courseId}/chapters/${chapterId}/${timestamp}-${random}.${fileExtension}`;
};

module.exports = {
  initBlobService,
  getBlobServiceClient,
  uploadToBlob,
  deleteFromBlob,
  generateUniqueBlobName,
};

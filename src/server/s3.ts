import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

class MyS3Client {
  private s3Client = new S3Client({ region: process.env.AWS_REGION });

  async getObject(key: string): Promise<string | null> {
    try {
      const s3Response = await this.s3Client.send(
        new GetObjectCommand({
          Key: key,
          Bucket: process.env.AWS_BUCKET_NAME,
        }),
      );
      return await s3Response.Body!.transformToString();
    } catch (e) {
      if (
        e instanceof S3ServiceException &&
        (e.$metadata.httpStatusCode === 403 ||
          e.$metadata.httpStatusCode === 404)
      ) {
        return null;
      }
      throw e;
    }
  }

  async putObject(key: string, object: string) {
    const command = new PutObjectCommand({
      Body: object,
      Key: key,
      Bucket: process.env.AWS_BUCKET_NAME,
    });
    await this.s3Client.send(command);
  }
}

export const s3 = new MyS3Client();

/**
 * Mock S3 client for testing
 * Stores data in-memory instead of actual S3
 */
export class MockS3Client {
  private storage: Map<string, string> = new Map();

  async putObject(key: string, content: string): Promise<void> {
    this.storage.set(key, content);
  }

  async getObject(key: string): Promise<string | null> {
    return this.storage.get(key) ?? null;
  }

  async doesObjectExist(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  getObjectUrl(key: string): string {
    return `https://mock-s3.example.com/${key}`;
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock Overpass API response for testing
 */
export function createMockOverpassResponse() {
  return {
    version: 0.6,
    generator: "Overpass API",
    elements: [
      {
        type: "way",
        id: 12345,
        nodes: [1, 2, 3],
        tags: {
          highway: "residential",
          name: "Main Street",
        },
      },
      {
        type: "node",
        id: 1,
        lat: 37.7749,
        lon: -122.4194,
      },
      {
        type: "node",
        id: 2,
        lat: 37.7750,
        lon: -122.4195,
      },
      {
        type: "node",
        id: 3,
        lat: 37.7751,
        lon: -122.4196,
      },
    ],
  };
}

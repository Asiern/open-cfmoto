import { CloudAuthClient } from '@open-cfmoto/cloud-client';

export interface CloudLoginResult {
  token: string;
  userId: string | null;
}

class CloudAuthService {
  private readonly client = new CloudAuthClient();

  async login(username: string, password: string): Promise<CloudLoginResult> {
    const token = await this.client.login(username, password);
    return {
      token,
      userId: this.client.getUserId(),
    };
  }
}

export const cloudAuthService = new CloudAuthService();

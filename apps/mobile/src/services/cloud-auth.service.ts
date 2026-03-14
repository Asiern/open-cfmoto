import { CloudAuthClient, UserVehicle, VehicleClient } from '@open-cfmoto/cloud-client';

export interface CloudLoginResult {
  token: string;
  userId: string | null;
}

class CloudAuthService {
  private readonly authClient = new CloudAuthClient();
  private readonly vehicleClient = new VehicleClient();
  private token: string | null = null;
  private userId: string | null = null;

  async login(username: string, password: string): Promise<CloudLoginResult> {
    const token = await this.authClient.login(username, password);
    const userId = this.authClient.getUserId();
    this.token = token;
    this.userId = userId;
    return {
      token,
      userId,
    };
  }

  async getUserVehicles(position = 1): Promise<UserVehicle[]> {
    if (!this.token) {
      throw new Error('Cloud session not initialized. Run login() first.');
    }
    return this.vehicleClient.getUserVehicles(this.token, this.userId, position);
  }
}

export const cloudAuthService = new CloudAuthService();

import { AccountClient, CloudAuthClient, RegisterRequest, UserVehicle, VehicleClient } from '@open-cfmoto/cloud-client';
import { useAuthStore } from '../stores/auth.store';
import { useBleAuthStore } from '../stores/ble-auth.store';

export interface CloudLoginResult {
  token: string;
  userId: string | null;
}

export interface CloudSession {
  token: string | null;
  userId: string | null;
  idcard: string | null;
}

function isEmailIdcard(value: string): boolean {
  return value.includes('@');
}

function normalizePhoneAreaCode(areaCode?: string): string | undefined {
  if (!areaCode) return undefined;
  const normalized = areaCode.trim().replace(/^\+/, '');
  return normalized || undefined;
}

class CloudAuthService {
  private readonly authClient = new CloudAuthClient();
  private readonly accountClient = new AccountClient();
  private readonly vehicleClient = new VehicleClient();
  async login(username: string, password: string): Promise<CloudLoginResult> {
    const token = await this.authClient.login(username, password);
    const userId = this.authClient.getUserId();
    useAuthStore.getState().setSession({ token, userId, idcard: username });
    this.cacheBleAuthKeys(token, userId, username).catch((err) => {
      console.warn('[cloud-auth] Could not pre-cache BLE auth keys:', err);
    });
    return {
      token,
      userId,
    };
  }

  async register(req: RegisterRequest): Promise<CloudLoginResult> {
    const normalizedReq: RegisterRequest = {
      ...req,
      areaCode: isEmailIdcard(req.idcard)
        ? req.areaCode
        : normalizePhoneAreaCode(req.areaCode),
    };
    const result = await this.accountClient.register(normalizedReq);
    useAuthStore
      .getState()
      .setSession({ token: result.token, userId: result.userId ?? null, idcard: req.idcard });
    this.cacheBleAuthKeys(result.token, result.userId ?? null, req.idcard).catch((err) => {
      console.warn('[cloud-auth] Could not pre-cache BLE auth keys after register:', err);
    });
    return {
      token: result.token,
      userId: result.userId ?? null,
    };
  }

  async sendVerificationCode(
    idcard: string,
    options?: { areaCode?: string; areaNo?: string },
  ): Promise<void> {
    const isEmail = isEmailIdcard(idcard);
    await this.accountClient.sendCode({
      idcard,
      areaCode: isEmail ? options?.areaCode : normalizePhoneAreaCode(options?.areaCode),
      areaNo: options?.areaNo,
    });
  }

  async checkVerificationCode(
    idcard: string,
    verifyCode: string,
    options?: { areaCode?: string; areaNo?: string },
  ): Promise<void> {
    const isEmail = isEmailIdcard(idcard);
    await this.accountClient.checkCode({
      idcard,
      verifyCode,
      areaCode: isEmail ? options?.areaCode : normalizePhoneAreaCode(options?.areaCode),
      areaNo: options?.areaNo,
    });
  }

  /**
   * Cloud API currently requires old+new password under an authenticated token.
   * We perform a login first to obtain a token for update_password.
   */
  async changePassword(
    idcard: string,
    currentPassword: string,
    newPassword: string,
    verifyCode?: string,
    options?: { areaCode?: string; areaNo?: string },
  ): Promise<void> {
    if (verifyCode?.trim()) {
      await this.checkVerificationCode(idcard, verifyCode.trim(), options);
    }
    const token = await this.authClient.login(idcard, currentPassword);
    useAuthStore
      .getState()
      .setSession({ token, userId: this.authClient.getUserId(), idcard });
    await this.accountClient.updatePassword(token, {
      oldPassword: currentPassword,
      newPassword,
    });
  }

  logout(): void {
    useAuthStore.getState().clearSession();
  }

  getSession(): CloudSession {
    const state = useAuthStore.getState();
    return {
      token: state.token,
      userId: state.userId,
      idcard: state.idcard,
    };
  }

  isLoggedIn(): boolean {
    return Boolean(useAuthStore.getState().token);
  }

  hasLocalBleAuthKey(): boolean {
    return useBleAuthStore.getState().hasAnyKey();
  }

  async getUserVehicles(position = 1): Promise<UserVehicle[]> {
    const session = this.getSession();
    if (!session.token) {
      throw new Error('Cloud session not initialized. Run login() first.');
    }
    return this.vehicleClient.getUserVehicles(session.token, session.userId, position);
  }

  private async cacheBleAuthKeys(
    token: string,
    userId: string | null,
    idcard: string | null,
  ): Promise<void> {
    const vehicles = await this.vehicleClient.getVehicles(token);
    for (const vehicle of vehicles) {
      const vehicleId = vehicle.vehicleId;
      if (!vehicleId) continue;
      try {
        const detail = await this.vehicleClient.getVehicleDetail(vehicleId, token, userId);
        const encryptInfo = detail.encryptInfo ?? detail.vehicleInfo?.encryptInfo;
        if (!encryptInfo?.encryptValue || !encryptInfo?.key) continue;
        const peripheralId = detail.btMac ?? detail.vehicleInfo?.btMac ?? vehicle.btMac;
        if (!peripheralId) continue;
        useBleAuthStore.getState().upsertRecord({
          vehicleId,
          peripheralId,
          encryptValue: encryptInfo.encryptValue,
          key: encryptInfo.key,
          idcard,
          userId,
        });
      } catch (error) {
        console.warn(`[cloud-auth] Failed to cache BLE key for vehicle ${vehicleId}:`, error);
      }
    }
  }
}

export const cloudAuthService = new CloudAuthService();

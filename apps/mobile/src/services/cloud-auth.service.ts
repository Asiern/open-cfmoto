import {
  AccountClient,
  CLOUD_CONFIG,
  CloudAuthClient,
  LoginArea,
  RegionClient,
  RegisterRequest,
  UserVehicle,
  VehicleClient,
  resolveBaseUrlFromRegionDomain,
} from '@open-cfmoto/cloud-client';
import { useAuthStore } from '../stores/auth.store';
import { useBleAuthStore } from '../stores/ble-auth.store';
import { useRegionStore } from '../stores/region.store';

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
  private readonly regionClient = new RegionClient();

  private resolveActiveBaseUrl(): string {
    const selected = useRegionStore.getState().selected;
    return selected?.domain ? resolveBaseUrlFromRegionDomain(selected.domain) : CLOUD_CONFIG.BASE_URL;
  }

  private buildAuthClient(): CloudAuthClient {
    return new CloudAuthClient(this.resolveActiveBaseUrl());
  }

  private buildAccountClient(): AccountClient {
    return new AccountClient(this.resolveActiveBaseUrl());
  }

  private buildVehicleClient(): VehicleClient {
    return new VehicleClient(this.resolveActiveBaseUrl());
  }

  async fetchLoginAreas(force = false): Promise<LoginArea[]> {
    const state = useRegionStore.getState();
    if (!force && state.available.length > 0) {
      return state.available;
    }
    const areas = await this.regionClient.listLoginAreas();
    const sorted = [...areas].sort((a, b) => {
      const aKey = (a.countrySortedKey || a.countryENUS || a.country || a.areaNo || '').toUpperCase();
      const bKey = (b.countrySortedKey || b.countryENUS || b.country || b.areaNo || '').toUpperCase();
      return aKey.localeCompare(bKey);
    });
    useRegionStore.getState().setAvailable(sorted);
    return sorted;
  }

  selectLoginArea(area: LoginArea | null): void {
    useRegionStore.getState().setSelected(area);
  }

  getSelectedLoginArea(): LoginArea | null {
    return useRegionStore.getState().selected;
  }

  async login(username: string, password: string): Promise<CloudLoginResult> {
    const selected = this.getSelectedLoginArea();
    const authClient = this.buildAuthClient();
    const token = await authClient.login(username, password, { areaNo: selected?.areaNo });
    const userId = authClient.getUserId();
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
    const accountClient = this.buildAccountClient();
    const selected = this.getSelectedLoginArea();
    const normalizedReq: RegisterRequest = {
      ...req,
      areaCode: isEmailIdcard(req.idcard)
        ? req.areaCode
        : normalizePhoneAreaCode(req.areaCode),
      areaNo: req.areaNo ?? selected?.areaNo,
    };
    const result = await accountClient.register(normalizedReq);
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
    const accountClient = this.buildAccountClient();
    const selected = this.getSelectedLoginArea();
    const isEmail = isEmailIdcard(idcard);
    await accountClient.sendCode({
      idcard,
      areaCode: isEmail ? options?.areaCode : normalizePhoneAreaCode(options?.areaCode),
      areaNo: options?.areaNo ?? selected?.areaNo,
    });
  }

  async checkVerificationCode(
    idcard: string,
    verifyCode: string,
    options?: { areaCode?: string; areaNo?: string },
  ): Promise<void> {
    const accountClient = this.buildAccountClient();
    const selected = this.getSelectedLoginArea();
    const isEmail = isEmailIdcard(idcard);
    await accountClient.checkCode({
      idcard,
      verifyCode,
      areaCode: isEmail ? options?.areaCode : normalizePhoneAreaCode(options?.areaCode),
      areaNo: options?.areaNo ?? selected?.areaNo,
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
    const accountClient = this.buildAccountClient();
    const selected = this.getSelectedLoginArea();
    if (verifyCode?.trim()) {
      await this.checkVerificationCode(idcard, verifyCode.trim(), options);
    }
    const authClient = this.buildAuthClient();
    const token = await authClient.login(idcard, currentPassword, {
      areaNo: options?.areaNo ?? selected?.areaNo,
    });
    useAuthStore
      .getState()
      .setSession({ token, userId: authClient.getUserId(), idcard });
    await accountClient.updatePassword(token, {
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
    const vehicleClient = this.buildVehicleClient();
    return vehicleClient.getUserVehicles(session.token, session.userId, position);
  }

  private async cacheBleAuthKeys(
    token: string,
    userId: string | null,
    idcard: string | null,
  ): Promise<void> {
    const vehicleClient = this.buildVehicleClient();
    const vehicles = await vehicleClient.getVehicles(token);
    for (const vehicle of vehicles) {
      const vehicleId = vehicle.vehicleId;
      if (!vehicleId) continue;
      try {
        const detail = await vehicleClient.getVehicleDetail(vehicleId, token, userId);
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

import { useState, useCallback } from 'react';
import { bleService } from '../services/ble.service';
import { PeripheralInfo } from '@open-cfmoto/ble-protocol';
import { useSettingsStore } from '../stores/settings.store';

export function useBleConnection() {
  const [scanning, setScanning] = useState(false);
  const [peripherals, setPeripherals] = useState<PeripheralInfo[]>([]);
  const useMock = useSettingsStore((s) => s.useMockBike);

  const startScan = useCallback(async () => {
    bleService.initialize(useMock);
    setScanning(true);
    setPeripherals([]);
    try {
      const found = await bleService.scan();
      setPeripherals(found);
    } finally {
      setScanning(false);
    }
  }, [useMock]);

  const connectTo = useCallback(async (peripheralId: string) => {
    await bleService.connect(peripheralId);
  }, []);

  const disconnect = useCallback(() => {
    bleService.disconnect();
  }, []);

  return { scanning, peripherals, startScan, connectTo, disconnect };
}

"use server";

import { setInternalDevice } from "@/lib/internalTraffic";

export async function turnOnInternalDevice(): Promise<void> {
  await setInternalDevice(true);
}

export async function turnOffInternalDevice(): Promise<void> {
  await setInternalDevice(false);
}

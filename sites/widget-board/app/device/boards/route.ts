import { handleDeviceRead } from "../../../lib/device-http";
import { devices } from "../../../lib/device-store";
import { repository } from "../../../lib/store";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleDeviceRead(request, devices, repository);

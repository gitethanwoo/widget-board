import { requireChatGPTUser } from "../chatgpt-auth";
import { devices } from "../../lib/device-store";
export const dynamic = "force-dynamic";
export default async function ConnectedDevices() {
  const user = await requireChatGPTUser("/devices");
  const connections = await devices.list(user.userId);
  return <main><header className="topbar"><a className="brand" href="/">← Widget Board</a></header><section className="intro"><div><p className="eyebrow">YOUR PRIVATE CONNECTIONS</p><h1>Connected devices.</h1><p className="lede">Each connection can read your canvas. Revoke one to stop future downloads.</p></div></section>
    {connections.length === 0 && <p className="lede">No devices connected. Open Widget Board on your iPhone to connect.</p>}
    <section className="workspace-grid">{connections.map(device => <article className="compose-card" key={device.id}><h2>{device.name}</h2><p className="lede">Connected {device.createdAt.slice(0, 10)}<br />Expires {device.expiresAt.slice(0, 10)}</p><form action={`/devices/${device.id}/revoke`} method="post"><button className="primary-button">Revoke access</button></form></article>)}</section>
  </main>;
}

import { getOsColor, Host } from "@/lib/data";

// A GitHub-style identicon: a 5x5 pixel pattern, mirrored left to right,
// derived from the host key so it is stable for a host, coloured by the
// host's operating system.
const GRID = 5;
const HALF = 3; // columns 0-2 are generated, 3-4 mirror 1-0

export function avatarCells(hostkey: string): boolean[][] {
  const hex = hostkey.replace(/^SHA=/, "").toLowerCase();
  const bits: boolean[] = [];
  for (const ch of hex) {
    const nibble = parseInt(ch, 16);
    if (Number.isNaN(nibble)) continue;
    for (let b = 3; b >= 0; b--) bits.push(((nibble >> b) & 1) === 1);
  }
  // Fall back to a fixed pattern for keys without enough hex digits.
  while (bits.length < GRID * HALF) bits.push(bits.length % 2 === 0);
  const rows: boolean[][] = [];
  for (let y = 0; y < GRID; y++) {
    const left = Array.from({ length: HALF }, (_, x) => bits[y * HALF + x]);
    rows.push([...left, left[1], left[0]]);
  }
  return rows;
}

export default function HostAvatar({ host, size = 40 }: { host: Host; size?: number }) {
  const color = getOsColor(host.os);
  const cells = avatarCells(host.id);
  const status = host.online ? "Online" : "Offline";
  return (
    <span
      className="host-avatar-wrap"
      style={{ width: size, height: size }}
      title={status}
      data-testid="host-avatar-wrap"
    >
      <svg
        className="host-avatar"
        viewBox={`0 0 ${GRID} ${GRID}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Avatar of ${host.hostname} (${status.toLowerCase()})`}
        data-testid="host-avatar"
        data-color={color}
      >
        <rect width={GRID} height={GRID} className="host-avatar-bg" />
        {cells.flatMap((row, y) =>
          row.map((on, x) =>
            on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null,
          ),
        )}
      </svg>
      <span
        className={`host-status ${host.online ? "host-status-online" : "host-status-offline"}`}
        style={{ width: Math.round(size * 0.3), height: Math.round(size * 0.3) }}
        aria-hidden="true"
        data-testid="host-status"
        data-online={host.online ? "true" : "false"}
      />
    </span>
  );
}

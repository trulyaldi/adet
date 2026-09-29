// Downloads every registered pack that has a direct download, verifies its
// checksum, unpacks it into assets/game/raw/<name>/ and keeps a copy of its
// license in assets/game/licenses/<name>/ (committed).
//
//   npm run game:fetch
//
// Packs without a direct download (itch.io needs a browser) are listed, not
// fetched: see docs/quest/OWNER_ACTIONS.md.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LICENSES, loadRegistry, packDir, PERMISSIVE } from './packs';

async function main() {
  let failed = false;
  for (const p of loadRegistry()) {
    if (!PERMISSIVE.test(p.license)) {
      console.error(`✖ ${p.name}: license "${p.license}" is not allowed (CC0 / CC-BY / explicitly permissive only)`);
      failed = true;
      continue;
    }
    const dir = packDir(p);
    if (fs.existsSync(dir)) {
      console.log(`✓ ${p.name} (present)`);
    } else if (!p.download || !p.sha256) {
      console.log(`… ${p.name}: download it by hand from ${p.url} into assets/game/raw/${p.name}/`);
      continue;
    } else {
      const res = await fetch(p.download);
      if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} from ${p.download}`);
      const zip = Buffer.from(await res.arrayBuffer());
      const sum = crypto.createHash('sha256').update(zip).digest('hex');
      if (sum !== p.sha256) throw new Error(`${p.name}: checksum ${sum} ≠ registered ${p.sha256} (the pack changed upstream: review it, then update the registry)`);
      const tmp = path.join(os.tmpdir(), `${p.name}-${process.pid}.zip`);
      fs.writeFileSync(tmp, zip);
      fs.mkdirSync(dir, { recursive: true });
      execFileSync('unzip', ['-q', '-o', tmp, '-d', dir]);
      fs.unlinkSync(tmp);
      console.log(`↓ ${p.name} (${(zip.length / 1024).toFixed(0)} KB, sha256 ok)`);
    }
    const license = ['License.txt', 'LICENSE.txt', 'license.txt', 'LICENSE'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
    if (license) {
      fs.mkdirSync(path.join(LICENSES, p.name), { recursive: true });
      fs.copyFileSync(license, path.join(LICENSES, p.name, 'License.txt'));
    } else {
      console.error(`✖ ${p.name}: no license file found in the pack`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

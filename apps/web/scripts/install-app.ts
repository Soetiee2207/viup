// Cài viup thành app trên máy (Linux): có icon trong trình mở ứng dụng, bấm là mở cửa sổ quản lý.
//   npm run app:install     build giao diện + cài (chạy lại sau mỗi lần cập nhật code)
//   npm run app:uninstall   gỡ
// Gồm: service systemd (user) chạy giao diện ở 127.0.0.1:3210, script mở ~/.local/bin/viup, file .desktop + icon.
import {spawnSync} from 'node:child_process';
import {chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {findRepoRoot} from '@viup/core';

const PORT = 3210;
const URL = `http://127.0.0.1:${PORT}`;
const root = findRepoRoot();
const web = join(root, 'apps', 'web');
const home = homedir();
const paths = {
	service: join(home, '.config/systemd/user/viup-web.service'),
	bin: join(home, '.local/bin/viup'),
	desktop: join(home, '.local/share/applications/viup.desktop'),
	icon: join(home, '.local/share/icons/hicolor/256x256/apps/viup.png'),
};
const run = (cmd: string, args: string[], opts: {cwd?: string; allowFail?: boolean} = {}) => {
	const r = spawnSync(cmd, args, {stdio: 'inherit', cwd: opts.cwd ?? root});
	if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.join(' ')} lỗi`);
};

if (process.argv[2] === 'uninstall') {
	run('systemctl', ['--user', 'disable', '--now', 'viup-web.service'], {allowFail: true});
	for (const p of Object.values(paths)) rmSync(p, {force: true});
	run('systemctl', ['--user', 'daemon-reload']);
	console.log('Đã gỡ app viup.');
	process.exit(0);
}

console.log('• Build giao diện (1–2 phút)...');
run('npm', ['run', 'build', '-w', '@viup/web']);

for (const p of Object.values(paths)) mkdirSync(join(p, '..'), {recursive: true});
writeFileSync(
	paths.service,
	`[Unit]
Description=viup: giao diện quản lý (${URL})

[Service]
WorkingDirectory=${web}
Environment=PATH=${process.env.PATH}
Environment=NODE_ENV=production
ExecStart=${process.execPath} ${join(root, 'node_modules/next/dist/bin/next')} start -p ${PORT} -H 127.0.0.1
Restart=on-failure
`,
);

// Mở: bật service nếu chưa chạy, đợi sẵn sàng, rồi mở thành cửa sổ app riêng
writeFileSync(
	paths.bin,
	`#!/bin/bash
systemctl --user start viup-web.service
for i in $(seq 1 60); do curl -fs -o /dev/null ${URL} && break; sleep 0.25; done
if command -v omarchy-launch-webapp >/dev/null; then exec omarchy-launch-webapp ${URL}
elif command -v chromium >/dev/null; then exec chromium --app=${URL}
else exec xdg-open ${URL}; fi
`,
);
chmodSync(paths.bin, 0o755);

copyFileSync(join(root, 'docs/audit/app-icon.png'), paths.icon);
writeFileSync(
	paths.desktop,
	`[Desktop Entry]
Version=1.0
Name=viup
GenericName=Quản lý video Shorts
Comment=Xem, duyệt và đăng video Crab vibe
Exec=${paths.bin}
Icon=${paths.icon}
Terminal=false
Type=Application
Categories=AudioVideo;Video;
StartupNotify=true
`,
);

run('systemctl', ['--user', 'daemon-reload']);
// Khởi động lại để nạp bản build mới (nếu đang chạy)
run('systemctl', ['--user', 'restart', 'viup-web.service']);
run('update-desktop-database', [join(home, '.local/share/applications')], {allowFail: true});
console.log(`\n✓ Đã cài app viup. Mở trình mở ứng dụng (Super + Space), gõ "viup".\n  Hoặc mở trình duyệt: ${URL}`);

// Cài hẹn giờ systemd (user) chạy `npm run daily`:
//   7:00  — làm video cho hôm nay/ngày mai
//   15:30 — chạy bù sau khi hạn mức Gemini reset (0h giờ Thái Bình Dương ≈ 14–15h Việt Nam)
// Persistent=true: máy tắt lúc tới giờ thì bật lên sẽ chạy bù.
//   npm run daily:install      cài / cập nhật
//   npm run daily:uninstall    gỡ
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {findRepoRoot} from '@viup/core';

const dir = join(homedir(), '.config', 'systemd', 'user');
const root = findRepoRoot();
const systemctl = (...args: string[]) => {
	const r = spawnSync('systemctl', ['--user', ...args], {stdio: 'inherit'});
	if (r.status !== 0) throw new Error(`systemctl --user ${args.join(' ')} lỗi`);
};

if (process.argv[2] === 'uninstall') {
	spawnSync('systemctl', ['--user', 'disable', '--now', 'viup-daily.timer'], {stdio: 'inherit'});
	rmSync(join(dir, 'viup-daily.timer'), {force: true});
	rmSync(join(dir, 'viup-daily.service'), {force: true});
	systemctl('daemon-reload');
	console.log('Đã gỡ hẹn giờ viup.');
	process.exit(0);
}

mkdirSync(dir, {recursive: true});
writeFileSync(
	join(dir, 'viup-daily.service'),
	`[Unit]
Description=viup: làm video Shorts hằng ngày

[Service]
Type=oneshot
WorkingDirectory=${root}
# PATH lúc cài (cần node, npx, uv, ffmpeg)
Environment=PATH=${process.env.PATH}
ExecStart=${process.execPath} ${join(root, 'worker/src/daily.ts')}
TimeoutStartSec=3h
Nice=10
`,
);
writeFileSync(
	join(dir, 'viup-daily.timer'),
	`[Unit]
Description=viup: hẹn giờ làm video

[Timer]
OnCalendar=*-*-* 07:00:00
OnCalendar=*-*-* 15:30:00
Persistent=true
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
`,
);
systemctl('daemon-reload');
systemctl('enable', '--now', 'viup-daily.timer');
spawnSync('systemctl', ['--user', 'list-timers', 'viup-daily.timer', '--no-pager'], {stdio: 'inherit'});
console.log('\nĐã cài. Xem log: data/logs/<ngày>.log — hoặc: journalctl --user -u viup-daily -n 50');

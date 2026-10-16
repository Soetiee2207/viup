import type {Metadata} from 'next';
import {schema} from '@viup/core';
import {getDb} from '@/lib/db';
import {geminiUsage, isRunning, timerInfo} from '@/lib/viup';
import {runDaily} from './actions';
import {ActionButton, AutoRefresh, Nav} from './ui';
import './globals.css';

export const metadata: Metadata = {
	title: 'viup',
	description: 'Quản lý tool tự động làm video Shorts',
};
export const dynamic = 'force-dynamic';

const fmtTime = (s: string | null) => {
	if (!s) return '—';
	const d = new Date(s.replace(/^\w{3} /, '').replace(/ \+\d+$/, ''));
	return Number.isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN', {weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'});
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
	const db = await getDb();
	const [channel] = await db.select().from(schema.channels).limit(1);
	const running = isRunning();
	const timer = timerInfo();
	const usage = await geminiUsage(db);
	const main = usage.find((u) => !u.model.includes('lite'))?.n ?? 0;
	const lite = usage.find((u) => u.model.includes('lite'))?.n ?? 0;

	return (
		<html lang="vi">
			<body>
				<header className="top">
					<div className="brand">
						<img src="/icon.png" alt="" width={36} height={36} />
						<b>
							vi<span>up</span>
						</b>
						<span className="muted">· {channel?.name ?? 'Crab vibe'}</span>
					</div>
					<Nav />
				</header>
				<section className="status">
					<div>
						{channel && !channel.active ? (
							<span className="badge warn">⏸ Đang tạm dừng</span>
						) : running ? (
							<span className="badge live">● Đang làm video…</span>
						) : (
							<span className="badge ok">Sẵn sàng</span>
						)}
						<span className="muted">
							{' '}
							Tự chạy kế tiếp: <b>{timer.installed ? fmtTime(timer.next) : 'chưa cài hẹn giờ (npm run daily:install)'}</b>
						</span>
					</div>
					<div className="muted">
						Gemini hôm nay: {Number(main)}/20 · lite {Number(lite)}/200
					</div>
					<ActionButton action={runDaily} className="btn primary">
						{running ? 'Đang chạy…' : '▶ Làm video ngay'}
					</ActionButton>
				</section>
				<AutoRefresh active={running} />
				<main>{children}</main>
			</body>
		</html>
	);
}

'use client';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';

export function CopyButton({text, label}: {text: string; label: string}) {
	const [done, setDone] = useState(false);
	return (
		<button
			type="button"
			className="btn small"
			disabled={!text}
			onClick={async () => {
				await navigator.clipboard.writeText(text);
				setDone(true);
				setTimeout(() => setDone(false), 1500);
			}}
		>
			{done ? '✓ Đã copy' : label}
		</button>
	);
}

// Nút gọi server action, hiện trạng thái đang chạy
export function ActionButton({action, children, className = 'btn', confirm: ask}: {action: () => Promise<void>; children: React.ReactNode; className?: string; confirm?: string}) {
	const [pending, start] = useTransition();
	return (
		<button type="button" className={className} disabled={pending} onClick={() => (!ask || window.confirm(ask)) && start(() => action())}>
			{pending ? '…' : children}
		</button>
	);
}

export function Nav() {
	const path = usePathname();
	const tabs = [
		['/', 'Video'],
		['/ideas', 'Ý tưởng'],
		['/settings', 'Cài đặt'],
		['/logs', 'Nhật ký'],
	];
	return (
		<nav className="tabs">
			{tabs.map(([href, label]) => (
				<Link key={href} href={href} className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'tab active' : 'tab'}>
					{label}
				</Link>
			))}
		</nav>
	);
}

// Tự làm mới trang khi tool đang chạy để thấy video mới
export function AutoRefresh({active, ms = 5000}: {active: boolean; ms?: number}) {
	const router = useRouter();
	useEffect(() => {
		if (!active) return;
		const t = setInterval(() => router.refresh(), ms);
		return () => clearInterval(t);
	}, [active, ms, router]);
	return null;
}

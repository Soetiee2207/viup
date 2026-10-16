import Link from 'next/link';
import {listLogs, localDate, readLog} from '@/lib/viup';

export const dynamic = 'force-dynamic';

export default async function LogsPage({searchParams}: {searchParams: Promise<{day?: string}>}) {
	const logs = listLogs();
	const {day: picked} = await searchParams;
	const day = picked ?? logs[0] ?? localDate();
	const text = readLog(day, 400);

	return (
		<div className="card">
			<div className="row">
				<h2>Nhật ký chạy</h2>
				<div className="days compact">
					{logs.slice(0, 7).map((d) => (
						<Link key={d} href={`/logs?day=${d}`} className={d === day ? 'day active' : 'day'}>
							{d.slice(5)}
						</Link>
					))}
				</div>
			</div>
			<pre className="log">{text || 'Chưa có nhật ký cho ngày này.'}</pre>
		</div>
	);
}

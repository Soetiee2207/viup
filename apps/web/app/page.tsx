import {jobStats, schema} from '@viup/core';
import {getDb} from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
	const db = await getDb();
	const channels = await db.select().from(schema.channels);
	const stats = await jobStats(db);

	return (
		<main>
			<h1>
				vi<span>up</span>
			</h1>
			<p className="muted">Tool tự động làm video ngắn — bảng giám sát</p>

			<div className="grid">
				{(['queued', 'running', 'done', 'failed'] as const).map((s) => (
					<div className="card" key={s}>
						<div className="muted">Job {s}</div>
						<div className="stat">{stats[s] ?? 0}</div>
					</div>
				))}
			</div>

			<div className="card">
				<h2>Kênh</h2>
				{channels.length === 0 ? (
					<p className="muted">Chưa có kênh — hãy chạy worker một lần để tạo kênh mặc định.</p>
				) : (
					<table>
						<thead>
							<tr>
								<th>Tên</th>
								<th>Định dạng</th>
								<th>Lịch</th>
								<th>Video/ngày</th>
								<th>Trạng thái</th>
							</tr>
						</thead>
						<tbody>
							{channels.map((c) => (
								<tr key={c.id}>
									<td>{c.name}</td>
									<td>
										{Object.entries(c.formats).map(([f, w]) => (
											<span className="badge" key={f} style={{marginRight: 4}}>
												{f} {Math.round(w * 100)}%
											</span>
										))}
									</td>
									<td>
										<code>{c.schedule}</code>
									</td>
									<td>{c.videosPerDay}</td>
									<td>{c.active ? 'Đang chạy' : 'Tạm dừng'}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</main>
	);
}

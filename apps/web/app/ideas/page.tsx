import {desc, eq} from 'drizzle-orm';
import {schema} from '@viup/core';
import {getDb} from '@/lib/db';
import {addIdea, discoverIdeas, rejectIdea} from '../actions';
import {ActionButton} from '../ui';

export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = {'fun-fact': 'Sự thật thú vị', zodiac: 'Cung hoàng đạo'};

export default async function IdeasPage() {
	const db = await getDb();
	const ideas = await db.select().from(schema.ideas).where(eq(schema.ideas.status, 'new')).orderBy(desc(schema.ideas.score), desc(schema.ideas.id));
	const done = await db.select().from(schema.ideas).where(eq(schema.ideas.status, 'used')).orderBy(desc(schema.ideas.id)).limit(30);

	return (
		<>
			<div className="card">
				<h2>Thêm chủ đề của bạn</h2>
				<p className="muted">Chủ đề tự thêm được ưu tiên làm trước ở lần chạy kế tiếp.</p>
				<form action={addIdea} className="addform">
					<input name="title" placeholder="vd: Vì sao cá heo ngủ mở một mắt" required maxLength={120} />
					<select name="format" defaultValue="fun-fact">
						<option value="fun-fact">Sự thật thú vị</option>
						<option value="zodiac">Cung hoàng đạo</option>
					</select>
					<button className="btn primary">Thêm</button>
				</form>
			</div>

			<div className="card">
				<div className="row">
					<h2>Kho ý tưởng chờ làm ({ideas.length})</h2>
					<ActionButton action={discoverIdeas} className="btn small">
						✨ Nghĩ thêm ý tưởng
					</ActionButton>
				</div>
				<p className="muted">Tool tự nghĩ và chấm điểm; điểm cao làm trước. Bấm ✕ để bỏ chủ đề không thích.</p>
				<table>
					<tbody>
						{ideas.map((i) => (
							<tr key={i.id}>
								<td>
									<span className={`badge ${i.format}`}>{FORMAT_LABEL[i.format] ?? i.format}</span>
								</td>
								<td>
									{i.title}
									{i.summary && i.summary !== 'Thêm tay từ app' ? <div className="muted small">{i.summary}</div> : null}
								</td>
								<td className="num">{i.score === 99 ? '★' : i.score?.toFixed(1)}</td>
								<td className="num">
									<ActionButton action={rejectIdea.bind(null, i.id)} className="btn small ghost">
										✕
									</ActionButton>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="card">
				<h2>Đã làm gần đây</h2>
				<ul className="plain">
					{done.map((i) => (
						<li key={i.id}>
							<span className={`badge ${i.format}`}>{FORMAT_LABEL[i.format] ?? i.format}</span> {i.title}
						</li>
					))}
				</ul>
			</div>
		</>
	);
}

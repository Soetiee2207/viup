import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';
import {Background} from './Background';
import {Character, type Face} from './Character';
import {TalkingProp} from './Prop';
import {countStep, type Scene as SceneData} from './timeline';
import type {Emotion} from './types';

const {fontFamily} = loadFont('normal', {weights: ['800'], subsets: ['vietnamese', 'latin']});

export type CrabConfig = {image: string; face: Face};

// Vùng màn hình 1080×1920: nhãn/hook ở trên (y≈200–380), vật chính ở giữa (y≈400–1150),
// phụ đề y≈1190–1420, cua nhỏ góc dưới trái. Chừa đáy cho chú thích + nút của Shorts/TikTok.

export const stickerText: React.CSSProperties = {
	fontFamily,
	fontWeight: 800,
	color: 'white',
	WebkitTextStroke: '16px #1b1430',
	paintOrder: 'stroke fill',
	textAlign: 'center',
	lineHeight: 1.1,
};

const REACTION: Record<Emotion, string | null> = {ngacnhien: 'HẢ?!', vui: '♪', buon: '...', binhthuong: null};

const Crab: React.FC<{
	crab: CrabConfig;
	width: number;
	emotion: Emotion;
	talk: number;
	lf: number;
	style: React.CSSProperties;
}> = ({crab, width, emotion, talk, lf, style}) => (
	<div style={{position: 'absolute', ...style}}>
		<Character image={crab.image} width={width} face={crab.face} emotion={emotion} talk={talk} lineFrame={lf} />
	</div>
);

// Cua nhỏ thò ra ở góc, phản ứng theo cảm xúc nhưng không nói
const CornerCrab: React.FC<{crab: CrabConfig; emotion: Emotion; lf: number}> = ({crab, emotion, lf}) => {
	const {fps} = useVideoConfig();
	const peek = spring({frame: lf - 6, fps, config: {damping: 12}});
	return (
		<Crab
			crab={crab}
			width={330}
			emotion={emotion}
			talk={0}
			lf={lf}
			style={{left: 10, top: 1400, transform: `translateY(${(1 - peek) * 400}px) rotate(8deg)`}}
		/>
	);
};

const Label: React.FC<{text: string; lf: number; at: number; emotion: Emotion}> = ({text, lf, at, emotion}) => {
	const {fps} = useVideoConfig();
	const s = spring({frame: lf - at, fps, config: {damping: 9, stiffness: 200}});
	const bg = emotion === 'buon' ? '#5b6bb5' : emotion === 'binhthuong' ? '#e8563a' : '#7b3fe4';
	return (
		<div style={{position: 'absolute', top: 200, left: 40, right: 40, display: 'flex', justifyContent: 'center'}}>
			<div
				style={{
					...stickerText,
					fontSize: text.length > 14 ? 74 : 90,
					background: bg,
					border: '10px solid #1b1430',
					borderRadius: 36,
					padding: '14px 40px',
					boxShadow: '0 14px 0 #1b1430',
					transform: `rotate(-3deg) scale(${s})`,
					WebkitTextStroke: '12px #1b1430',
				}}
			>
				{text}
			</div>
		</div>
	);
};

const Layout: React.FC<{scene: SceneData; crab: CrabConfig; talk: number; lf: number}> = ({scene, crab, talk, lf}) => {
	const {fps} = useVideoConfig();
	const {layout, props, emotion} = scene;
	const seed = `s${scene.index}`;
	const objTalk = scene.speaker === 'object' ? talk : 0;
	const crabTalk = scene.speaker === 'crab' ? talk : 0;

	if (layout === 'crab-closeup') {
		const reaction = REACTION[emotion];
		const r = spring({frame: lf - 5, fps, config: {damping: 8, stiffness: 220}});
		return (
			<>
				{/* translate theo % chiều cao ảnh để mắt cua luôn nằm ở y≈640 dù ảnh tỉ lệ nào */}
				<div style={{position: 'absolute', left: '50%', top: 640, transform: `translate(-50%, -${crab.face.eyeY * 100}%)`}}>
					<Character image={crab.image} width={1350} face={crab.face} emotion={emotion} talk={crabTalk} lineFrame={lf} />
				</div>
				{reaction && (
					<div
						style={{
							...stickerText,
							position: 'absolute',
							right: 50,
							top: 470,
							fontSize: 150,
							color: '#ffd43b',
							transform: `rotate(12deg) scale(${r})`,
						}}
					>
						{reaction}
					</div>
				)}
			</>
		);
	}

	if (layout === 'crab-presents') {
		const [main, ...rest] = props;
		return (
			<>
				<Crab
					crab={crab}
					width={560}
					emotion={emotion}
					talk={crabTalk}
					lf={lf}
					style={{left: -20, top: 560, transform: 'rotate(-6deg)'}}
				/>
				<TalkingProp
					icon={main.icon}
					size={520}
					face={main.face}
					emotion={emotion}
					talk={objTalk}
					enter={lf - 3}
					seed={`${seed}-0`}
					style={{position: 'absolute', left: 510, top: 400}}
				/>
				{rest.slice(0, 2).map((p, i) => (
					<TalkingProp
						key={i}
						icon={p.icon}
						size={230}
						face={false}
						emotion={emotion}
						talk={0}
						enter={lf - 8 - i * 4}
						seed={`${seed}-${i + 1}`}
						style={{position: 'absolute', left: 560 + i * 250, top: 900}}
					/>
				))}
			</>
		);
	}

	if (layout === 'versus') {
		const [a, b] = props;
		const half = (scene.to - scene.from) / 2;
		const slide = (delay: number) => spring({frame: lf - delay, fps, config: {damping: 13, stiffness: 160}});
		const vs = spring({frame: lf - 9, fps, config: {damping: 7, stiffness: 240}});
		return (
			<>
				{[a, b].map((p, i) => (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: i === 0 ? 50 : 600,
							top: i === 0 ? 470 : 640,
							transform: `translateX(${(1 - slide(i * 3)) * (i === 0 ? -700 : 700)}px)`,
						}}
					>
						<TalkingProp
							icon={p.icon}
							size={430}
							face={p.face}
							emotion={emotion}
							talk={(lf < half) === (i === 0) ? objTalk : 0}
							enter={lf}
							seed={`${seed}-${i}`}
						/>
					</div>
				))}
				<div
					style={{
						...stickerText,
						position: 'absolute',
						left: 0,
						right: 0,
						top: 680,
						fontSize: 170,
						color: '#ffd43b',
						transform: `scale(${vs}) rotate(-8deg)`,
					}}
				>
					VS
				</div>
				<CornerCrab crab={crab} emotion={emotion} lf={lf} />
			</>
		);
	}

	if (layout === 'count') {
		const p = props[0];
		const n = Math.min(p.count, 9);
		const step = countStep(n);
		const cols = n <= 3 ? n : n === 4 ? 2 : 3;
		const size = n === 1 ? 560 : n <= 3 ? 290 : n === 4 ? 330 : n <= 6 ? 290 : 250;
		const shown = Math.max(0, Math.min(n, Math.floor((lf - 4) / step) + 1));
		const numPop = spring({frame: lf - 4 - (shown - 1) * step, fps, config: {damping: 8, stiffness: 260}});
		return (
			<>
				<div
					style={{
						...stickerText,
						position: 'absolute',
						left: 0,
						right: 0,
						top: scene.label ? 390 : 300,
						fontSize: 240,
						color: '#ffd43b',
						transform: `scale(${shown > 0 ? 0.7 + 0.3 * numPop : 0})`,
					}}
				>
					{shown}
				</div>
				<div
					style={{
						position: 'absolute',
						left: 40,
						right: 40,
						top: 690,
						height: 470,
						display: 'grid',
						gridTemplateColumns: `repeat(${cols}, ${size}px)`,
						justifyContent: 'center',
						alignContent: 'center',
						gap: 10,
					}}
				>
					{Array.from({length: n}, (_, i) => (
						<TalkingProp
							key={i}
							icon={p.icon}
							size={size}
							face={p.face}
							emotion={emotion}
							talk={objTalk}
							enter={lf - 4 - i * step}
							seed={`${seed}-${i}`}
						/>
					))}
				</div>
				<CornerCrab crab={crab} emotion={emotion} lf={lf} />
			</>
		);
	}

	// object-hero: vật chính chiếm màn hình, vật phụ nhỏ hai bên, cua nhỏ ở góc
	const [main, ...rest] = props;
	return (
		<>
			<TalkingProp
				icon={main.icon}
				size={680}
				face={main.face}
				emotion={emotion}
				talk={objTalk}
				enter={lf - 2}
				seed={`${seed}-0`}
				style={{position: 'absolute', left: 200, top: 420}}
			/>
			{rest.slice(0, 2).map((p, i) => (
				<TalkingProp
					key={i}
					icon={p.icon}
					size={280}
					face={p.face}
					emotion={emotion}
					talk={0}
					enter={lf - 8 - i * 4}
					seed={`${seed}-${i + 1}`}
					style={{position: 'absolute', left: i === 0 ? 20 : 780, top: i === 0 ? 420 : 860}}
				/>
			))}
			<CornerCrab crab={crab} emotion={emotion} lf={lf} />
		</>
	);
};

// Một cảnh kín màn hình: nền động + bố cục + nhãn, đặt trong "máy quay" (Ken Burns, zoom-punch, lắc)
export const Scene: React.FC<{scene: SceneData; crab: CrabConfig; talk: number}> = ({scene, crab, talk}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const lf = frame - scene.from;
	const len = Math.max(1, scene.to - scene.from);

	const punch = 1 - spring({frame: lf, fps, config: {damping: 14, stiffness: 220}});
	const ken = interpolate(lf, [0, len], [0, 0.05], {extrapolateRight: 'clamp'});
	const scale = 1.08 + ken + punch * (scene.firstInLine ? 0.06 : 0.12);
	// Lắc khi ngạc nhiên, và khi nhãn đập vào màn hình
	const shakeAt = scene.emotion === 'ngacnhien' ? 0 : scene.label ? scene.labelAt : -1;
	const sl = lf - shakeAt;
	const amp = shakeAt >= 0 && sl >= 0 && sl < 14 ? 24 * (1 - sl / 14) : 0;
	const dx = (random(`shx${frame}`) - 0.5) * 2 * amp;
	const dy = (random(`shy${frame}`) - 0.5) * 2 * amp;
	const tilt = Math.sin(frame / 45 + scene.index) * 0.6;

	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${tilt}deg)`}}>
				<Background kind={scene.bg} emotion={scene.emotion} seed={scene.index} />
				<Layout scene={scene} crab={crab} talk={talk} lf={lf} />
			</AbsoluteFill>
			{scene.label && <Label text={scene.label} lf={lf} at={scene.labelAt} emotion={scene.emotion} />}
		</AbsoluteFill>
	);
};

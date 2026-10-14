import React from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Bg, Emotion} from './types';

// Bảng màu theo cảm xúc: [màu chính, màu phụ, màu sáng giữa]
const PALETTE: Record<Emotion, [string, string, string]> = {
	vui: ['#ffc933', '#ffa62b', '#fff4c2'],
	ngacnhien: ['#ff6f91', '#ff9671', '#ffe3ec'],
	binhthuong: ['#5cc8ff', '#3a8dff', '#e3f6ff'],
	buon: ['#3b4a7a', '#232a4d', '#8a9cc9'],
};

// Tâm của nền (nơi đặt vật chính)
const CX = 50;
const CY = 38;

const Burst: React.FC<{colors: [string, string, string]; seed: number}> = ({colors: [a, b, c], seed}) => {
	const frame = useCurrentFrame();
	const angle = seed * 37 + frame * 0.6;
	return (
		<AbsoluteFill>
			<AbsoluteFill
				style={{
					background: `repeating-conic-gradient(from ${angle}deg at ${CX}% ${CY}%, ${a} 0deg 11deg, ${b} 11deg 22.5deg)`,
				}}
			/>
			<AbsoluteFill
				style={{background: `radial-gradient(circle at ${CX}% ${CY}%, ${c} 0%, ${c}cc 12%, transparent 45%)`}}
			/>
		</AbsoluteFill>
	);
};

const SpeedLines: React.FC<{colors: [string, string, string]; seed: number}> = ({colors: [a, b, c], seed}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const cx = (width * CX) / 100;
	const cy = (height * CY) / 100;
	const R = Math.hypot(width, height);
	// Đổi bộ tia mỗi 2 khung hình -> cảm giác lao vút
	const tick = Math.floor(frame / 2);
	const n = 70;
	return (
		<AbsoluteFill style={{background: `radial-gradient(circle at ${CX}% ${CY}%, ${c} 0%, ${a} 35%, ${b} 100%)`}}>
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{Array.from({length: n}, (_, i) => {
					const ang = ((i + random(`sl${seed}-${i}`)) / n) * Math.PI * 2;
					const inner = R * (0.22 + 0.2 * random(`sli${seed}-${i}-${tick}`));
					const spread = 0.006 + 0.012 * random(`sls${seed}-${i}`);
					const p = (r: number, d: number) => `${cx + Math.cos(ang + d) * r},${cy + Math.sin(ang + d) * r}`;
					return <polygon key={i} points={`${p(inner, 0)} ${p(R, -spread)} ${p(R, spread)}`} fill="white" opacity={0.75} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};

const Bokeh: React.FC<{colors: [string, string, string]; seed: number}> = ({colors: [a, b, c], seed}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: `linear-gradient(160deg, ${a}, ${b})`}}>
			{Array.from({length: 22}, (_, i) => {
				const r = 50 + random(`br${seed}-${i}`) * 170;
				const speed = 0.4 + random(`bv${seed}-${i}`) * 1.2;
				const x = random(`bx${seed}-${i}`) * width + Math.sin(frame / 40 + i) * 30;
				const y = ((random(`by${seed}-${i}`) * (height + 400) - frame * speed) % (height + 400) + height + 400) % (height + 400) - 200;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x - r,
							top: y - r,
							width: r * 2,
							height: r * 2,
							borderRadius: '50%',
							background: `radial-gradient(circle, ${c}aa 0%, ${c}55 55%, transparent 72%)`,
							opacity: 0.35 + random(`bo${seed}-${i}`) * 0.5,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

const Gloom: React.FC<{colors: [string, string, string]; seed: number}> = ({colors: [a, b, c], seed}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: `linear-gradient(${a}, ${b})`}}>
			<svg width={width} height={height} style={{position: 'absolute'}}>
				{Array.from({length: 60}, (_, i) => {
					const x = random(`gx${seed}-${i}`) * (width + 200);
					const len = 40 + random(`gl${seed}-${i}`) * 50;
					const y = (random(`gy${seed}-${i}`) * height + frame * 38) % (height + 100) - 100;
					return <line key={i} x1={x} y1={y} x2={x - len * 0.25} y2={y + len} stroke={c} strokeWidth={4} strokeLinecap="round" opacity={0.5} />;
				})}
			</svg>
			<AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, transparent 35%, rgba(5,8,25,0.55) 100%)'}} />
		</AbsoluteFill>
	);
};

export const Background: React.FC<{kind: Bg; emotion: Emotion; seed: number}> = ({kind, emotion, seed}) => {
	// Nền buồn luôn tối; các nền khác dùng màu theo cảm xúc
	const colors = kind === 'gloom' ? PALETTE.buon : PALETTE[emotion === 'buon' ? 'binhthuong' : emotion];
	const Comp = {burst: Burst, speedlines: SpeedLines, bokeh: Bokeh, gloom: Gloom}[kind];
	return <Comp colors={colors} seed={seed} />;
};

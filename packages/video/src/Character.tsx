import React from 'react';
import {Img, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Emotion} from './types';

export type Face = {
	eyeLeftX: number;
	eyeRightX: number;
	eyeY: number;
	eyeSize: number;
	mouthX: number;
	mouthY: number;
	mouthWidth: number;
	color: string;
};

type Props = {
	image: string;
	width: number;
	face: Face;
	emotion: Emotion;
	talk: number; // 0..1, độ to giọng ở khung hình hiện tại
	lineFrame: number; // số khung hình kể từ khi bắt đầu câu hiện tại
};

// Chớp mắt ngẫu nhiên nhưng cố định (render lại vẫn giống hệt)
const useBlink = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const period = Math.round(fps * 3.2);
	const cycle = Math.floor(frame / period);
	const offset = Math.floor(random(`blink-${cycle}`) * (period - 8));
	const local = frame - cycle * period - offset;
	return local >= 0 && local < 5;
};

const Eye: React.FC<{
	x: number;
	y: number;
	size: number;
	open: number;
	color: string;
	brow: number;
	side: 1 | -1;
}> = ({
	x,
	y,
	size,
	open,
	color,
	brow,
	side,
}) => (
	<>
		<div
			style={{
				position: 'absolute',
				left: `${x * 100}%`,
				top: `${y * 100}%`,
				width: size,
				height: size * 1.2 * open,
				transform: 'translate(-50%, -50%)',
				borderRadius: '50%',
				background: color,
			}}
		>
			{open > 0.3 && (
				<div
					style={{
						position: 'absolute',
						left: '22%',
						top: '18%',
						width: size * 0.32,
						height: size * 0.32,
						borderRadius: '50%',
						background: 'white',
					}}
				/>
			)}
		</div>
		{brow !== 0 && (
			<div
				style={{
					position: 'absolute',
					left: `${x * 100}%`,
					top: `${y * 100}%`,
					width: size * 1.1,
					height: size * 0.18,
					borderRadius: size,
					background: color,
					// brow > 0: nhướng lên (ngạc nhiên), brow < 0: chau xuống (buồn)
					transform: `translate(-50%, ${-size * (brow > 0 ? 1.45 : 0.95)}px) rotate(${brow < 0 ? brow * 18 * side : 0}deg)`,
				}}
			/>
		)}
	</>
);

const Mouth: React.FC<{face: Face; width: number; talk: number; emotion: Emotion}> = ({face, width, talk, emotion}) => {
	const w = face.mouthWidth * width;
	const h = w * 0.8;
	const c = face.color;
	let shape: React.ReactNode;
	if (talk > 0.12) {
		const rx = (w / 2) * (0.65 + 0.35 * talk);
		const ry = h * 0.1 + h * 0.4 * talk;
		shape = (
			<>
				<ellipse cx={w / 2} cy={h / 2} rx={rx} ry={ry} fill={c} />
				<ellipse cx={w / 2} cy={h / 2 + ry * 0.55} rx={rx * 0.5} ry={ry * 0.35} fill="#e8677a" />
			</>
		);
	} else if (emotion === 'ngacnhien') {
		shape = <ellipse cx={w / 2} cy={h / 2} rx={w * 0.14} ry={h * 0.2} fill={c} />;
	} else {
		const curve = emotion === 'buon' ? -h * 0.25 : h * 0.3;
		shape = (
			<path
				d={`M ${w * 0.15} ${h / 2} Q ${w / 2} ${h / 2 + curve} ${w * 0.85} ${h / 2}`}
				stroke={c}
				strokeWidth={w * 0.09}
				strokeLinecap="round"
				fill="none"
			/>
		);
	}
	return (
		<svg
			width={w}
			height={h}
			style={{
				position: 'absolute',
				left: `${face.mouthX * 100}%`,
				top: `${face.mouthY * 100}%`,
				transform: 'translate(-50%, -50%)',
				overflow: 'visible',
			}}
		>
			{shape}
		</svg>
	);
};

// Nhân vật mẫu (bạch tuộc tím) khi chưa có ảnh từ Gemini
const SampleBody: React.FC<{width: number}> = ({width}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const outline = '#2b2140';
	return (
		<svg viewBox="0 0 600 660" width={width} height={(width * 660) / 600} style={{display: 'block'}}>
			{[110, 205, 300, 395, 490].map((x, i) => (
				<ellipse
					key={x}
					cx={x}
					cy={540}
					rx={46}
					ry={105}
					fill="#7b5ae0"
					stroke={outline}
					strokeWidth={14}
					transform={`rotate(${Math.sin(t * 3 + i) * 8} ${x} 450)`}
				/>
			))}
			<ellipse cx={300} cy={290} rx={245} ry={255} fill="#8e6cf0" stroke={outline} strokeWidth={14} />
			<ellipse cx={175} cy={370} rx={38} ry={22} fill="#f29bb8" opacity={0.8} />
			<ellipse cx={425} cy={370} rx={38} ry={22} fill="#f29bb8" opacity={0.8} />
		</svg>
	);
};

export const Character: React.FC<Props> = ({image, width, face, emotion, talk, lineFrame}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const blinking = useBlink();

	// Chuyển động: thở + nảy khi bắt đầu câu + theo cảm xúc
	const breathe = Math.sin((t * 2 * Math.PI) / 2.4);
	const pulse = lineFrame < 12 ? Math.sin((lineFrame / 12) * Math.PI) * 0.06 : 0;
	let y = breathe * 6 - talk * 10;
	let rotate = 0;
	let scale = 1 + pulse;
	if (emotion === 'ngacnhien' && lineFrame < 16) y -= Math.sin((lineFrame / 16) * Math.PI) * 90;
	if (emotion === 'vui') rotate = Math.sin((t * 2 * Math.PI) / 1.2) * 3;
	if (emotion === 'buon') {
		y += 18;
		rotate = -2;
		scale *= 0.98;
	}

	const eyeOpen = blinking ? 0.1 : emotion === 'ngacnhien' ? 1.25 : emotion === 'buon' ? 0.65 : 1;
	const brow = emotion === 'ngacnhien' ? 1 : emotion === 'buon' ? -1 : 0;
	const eyeSize = face.eyeSize * width;

	return (
		<div
			style={{
				position: 'relative',
				width,
				transformOrigin: '50% 100%',
				transform: `translateY(${y}px) rotate(${rotate}deg) scale(${scale}, ${scale * (1 + breathe * 0.012)})`,
			}}
		>
			{image ? <Img src={staticFile(image)} style={{width, display: 'block'}} /> : <SampleBody width={width} />}
			<Eye x={face.eyeLeftX} y={face.eyeY} size={eyeSize} open={eyeOpen} color={face.color} brow={brow} side={1} />
			<Eye x={face.eyeRightX} y={face.eyeY} size={eyeSize} open={eyeOpen} color={face.color} brow={brow} side={-1} />
			<Mouth face={face} width={width} talk={talk} emotion={emotion} />
		</div>
	);
};

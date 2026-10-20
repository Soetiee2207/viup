import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Background} from './Background';
import {Character} from './Character';
import {TalkingProp} from './Prop';
import {stickerText, type CrabConfig} from './Scene';
import {hasOwnFace} from './timeline';
import type {Guest} from './types';

// Bỏ emoji/hashtag khỏi tiêu đề để chữ trên ảnh bìa sạch
export const coverText = (title: string) =>
	title
		.replace(/#\S+/g, '')
		.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();

// Ảnh bìa: câu hỏi to ở trên, cua lớn ở dưới (+ nhân vật khách nếu có).
// Lưới hồ sơ TikTok cắt ảnh còn ~3:4 ở giữa (bỏ ~240px trên/dưới) -> chữ và mặt cua nằm trong y≈260–1680.
export const Cover: React.FC<{title: string; crab: CrabConfig; guest?: Guest | null}> = ({title, crab, guest}) => {
	const text = coverText(title);
	const fontSize = text.length > 50 ? 112 : text.length > 32 ? 128 : 148;
	return (
		<AbsoluteFill>
			<Background kind="burst" emotion="ngacnhien" seed={7} />
			<div
				style={{
					...stickerText,
					position: 'absolute',
					top: 270,
					left: 50,
					right: 50,
					fontSize,
					color: '#ffd43b',
					WebkitTextStroke: '22px #1b1430',
					textTransform: 'uppercase',
					transform: 'rotate(-3deg)',
				}}
			>
				{text}
			</div>
			{guest && (
				<TalkingProp
					icon={guest.icon}
					size={500}
					face={!hasOwnFace(guest.icon)}
					emotion="vui"
					talk={0}
					enter={30}
					seed="guest"
					style={{position: 'absolute', left: 560, top: 880, transform: 'rotate(8deg)'}}
				/>
			)}
			<div style={{position: 'absolute', left: guest ? -20 : 90, top: 900}}>
				<Character image={crab.image} width={900} face={crab.face} emotion="ngacnhien" talk={0} lineFrame={30} />
			</div>
		</AbsoluteFill>
	);
};

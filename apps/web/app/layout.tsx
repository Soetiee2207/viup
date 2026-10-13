import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'viup',
	description: 'Bảng điều khiển tool tự động làm video ngắn',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
	return (
		<html lang="vi">
			<body>{children}</body>
		</html>
	);
}

import type {NextConfig} from 'next';

const config: NextConfig = {
	transpilePackages: ['@viup/core'],
	serverExternalPackages: ['@libsql/client'],
};

export default config;

import type { EncodedPacket, InputTrack } from 'mediabunny';

import { BufferSource, BufferTarget, EncodedAudioPacketSource, EncodedPacketSink, EncodedVideoPacketSource, Input, MP4, Mp4OutputFormat, Output } from 'mediabunny';

import type { OffscreenMessage } from './messages';

// The service worker cannot create blob URLs, so muxing and the blob URL for
// chrome.downloads live in this offscreen document.
chrome.runtime.onMessage.addListener(
	(message: OffscreenMessage, _sender, sendResponse) => {
		if (message.target !== 'offscreen') {
			return;
		}

		if (message.type === 'mux') {
			void mux(message.videoUrl, message.audioUrl)
				.then(blob => sendResponse({ success: true, url: URL.createObjectURL(blob) }))
				.catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));

			return true;
		} else if (message.type === 'revoke') {
			URL.revokeObjectURL(message.url);
		}
	},
);

// Copies the encoded packets of both files into one MP4, without re-encoding.
async function mux(videoUrl: string, audioUrl: string) {
	const [ videoInput, audioInput ] = await Promise.all([ fetchInput(videoUrl), fetchInput(audioUrl) ]);
	const [ videoTrack, audioTrack ] = await Promise.all([ videoInput.getPrimaryVideoTrack(), audioInput.getPrimaryAudioTrack() ]);
	if (!videoTrack?.codec || !audioTrack?.codec) {
		throw new Error('Mux: missing video or audio track');
	}

	const [ videoConfig, audioConfig ] = await Promise.all([ videoTrack.getDecoderConfig(), audioTrack.getDecoderConfig() ]);
	if (!videoConfig || !audioConfig) {
		throw new Error('Mux: missing decoder config');
	}

	const output = new Output({
		format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
		target: new BufferTarget(),
	});
	const videoSource = new EncodedVideoPacketSource(videoTrack.codec);
	const audioSource = new EncodedAudioPacketSource(audioTrack.codec);

	output.addVideoTrack(videoSource, { rotation: videoTrack.rotation });
	output.addAudioTrack(audioSource);
	await output.start();

	// Concurrently, as the output may wait for one track to catch up with the other.
	await Promise.all([
		copyPackets(videoTrack, (packet, isFirst) => videoSource.add(packet, isFirst ? { decoderConfig: videoConfig } : undefined))
			.then(() => videoSource.close()),
		copyPackets(audioTrack, (packet, isFirst) => audioSource.add(packet, isFirst ? { decoderConfig: audioConfig } : undefined))
			.then(() => audioSource.close()),
	]);
	await output.finalize();

	if (!output.target.buffer) {
		throw new Error('Mux: empty output');
	}

	return new Blob([ output.target.buffer ], { type: 'video/mp4' });
}

async function fetchInput(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Mux: HTTP ${response.status} for ${new URL(url).pathname}`);
	}

	return new Input({ formats: [ MP4 ], source: new BufferSource(await response.arrayBuffer()) });
}

async function copyPackets(track: InputTrack, add: (packet: EncodedPacket, isFirst: boolean) => Promise<void>) {
	let isFirst = true;
	for await (const packet of new EncodedPacketSink(track).packets()) {
		await add(packet, isFirst);
		isFirst = false;
	}
}

export function bufferToWav(buffer, len) {
   let length = len || buffer.length;
   const numOfChan = buffer.numberOfChannels;
   const sampleRate = buffer.sampleRate;

   // WAV file buffer size
   const wavBuffer = new ArrayBuffer(44 + length * 2);
   const view = new DataView(wavBuffer);
   const channels = [];
   let i;
   let sample;
   let offset = 0;
   let pos = 0;

   // Write WAV Header
   // ChunkID
   writeString(view, pos, 'RIFF'); pos += 4;
   // ChunkSize
   view.setUint32(pos, 36 + length * 2, true); pos += 4;
   // Format
   writeString(view, pos, 'WAVE'); pos += 4;
   // Subchunk1ID
   writeString(view, pos, 'fmt '); pos += 4;
   // Subchunk1Size
   view.setUint32(pos, 16, true); pos += 4;
   // AudioFormat
   view.setUint16(pos, 1, true); pos += 2;
   // NumChannels (Force Mono for simplicity or Stereo)
   // Let's output Mono if 1 channel, Stereo if 2.
   // Actually, let's force single channel mixdown if source is complex, 
   // but usually we want what the buffer is. 
   // For this 'remix' context, 2 channels is safer.
   view.setUint16(pos, numOfChan, true); pos += 2;
   // SampleRate
   view.setUint32(pos, sampleRate, true); pos += 4;
   // ByteRate
   view.setUint32(pos, sampleRate * 2 * numOfChan, true); pos += 4;
   // BlockAlign
   view.setUint16(pos, numOfChan * 2, true); pos += 2;
   // BitsPerSample
   view.setUint16(pos, 16, true); pos += 2; // 16-bit PCM

   // Subchunk2ID
   writeString(view, pos, 'data'); pos += 4;
   // Subchunk2Size
   view.setUint32(pos, length * 2, true); pos += 4;

   // Interleave and Write Data
   // We'll just flatten to 16-bit PCM

   for (i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

   while (pos < view.byteLength) {
      for (i = 0; i < numOfChan; i++) {
         sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clip
         sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // PCM
         view.setInt16(pos, sample, true);
         pos += 2;
      }
      offset++;
   }

   return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
   for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
   }
}

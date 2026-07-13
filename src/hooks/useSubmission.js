import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitMemory = async ({ audioBlob, name, email, title, new_question_1, new_question_2 }) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      if (!audioBlob) throw new Error("No audio file provided.");

      // 1. Prepare File for Upload
      // Create a unique file path: public/timestamp_random.webm
      const fileExt = audioBlob.type.split('/')[1] || 'webm';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audios')
        .upload(filePath, audioBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: audioBlob.type || 'audio/webm'
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('audios')
        .getPublicUrl(filePath);

      const audioUrl = publicUrlData.publicUrl;

      // 4. Insert into Database
      const { error: dbError } = await supabase
        .from('memories')
        .insert([
          {
            name,
            email,
            title,
            new_question_1: (new_question_1 || '').trim() || null,
            new_question_2: (new_question_2 || '').trim() || null,
            audio_url: audioUrl,
            status: 'pending' // Enforced by default, but good to be explicit
          }
        ]);

      if (dbError) throw dbError;

      setSuccess(true);
      return true;

    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message || 'An unexpected error occurred during submission.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitMemory,
    isSubmitting,
    error,
    success
  };
};

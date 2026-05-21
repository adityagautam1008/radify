import { NextResponse } from 'next/server';

const MOCK_MOOD_PLAYLISTS: Record<string, { title: string; artist: string }[]> = {
  workout: [
    { title: 'Believer', artist: 'Imagine Dragons' },
    { title: 'Lose Yourself', artist: 'Eminem' },
    { title: 'Till I Collapse', artist: 'Eminem' },
    { title: 'Stronger', artist: 'Kanye West' },
    { title: 'Remember The Name', artist: 'Fort Minor' },
    { title: 'Power', artist: 'Kanye West' },
    { title: 'Level Up', artist: 'Ciara' },
    { title: 'High Hopes', artist: 'Panic! At The Disco' }
  ],
  sad: [
    { title: 'Someone Like You', artist: 'Adele' },
    { title: 'Fix You', artist: 'Coldplay' },
    { title: 'All I Want', artist: 'Kodaline' },
    { title: 'Say Something', artist: 'A Great Big World' },
    { title: 'Whiskey Lullaby', artist: 'Brad Paisley' },
    { title: 'Let Her Go', artist: 'Passenger' },
    { title: 'Stay With Me', artist: 'Sam Smith' },
    { title: 'Lovely', artist: 'Billie Eilish' }
  ],
  chill: [
    { title: 'Sweater Weather', artist: 'The Neighbourhood' },
    { title: 'Sunset Lover', artist: 'Petit Biscuit' },
    { title: 'Ocean Eyes', artist: 'Billie Eilish' },
    { title: 'Location', artist: 'Khalid' },
    { title: 'Put Your Records On', artist: 'Corinne Bailey Rae' },
    { title: 'Riptide', artist: 'Vance Joy' },
    { title: 'Best Part', artist: 'Daniel Caesar' },
    { title: 'Peaches', artist: 'Justin Bieber' }
  ],
  focus: [
    { title: 'Intro', artist: 'The xx' },
    { title: 'Clair de Lune', artist: 'Claude Debussy' },
    { title: 'Weightless', artist: 'Marconi Union' },
    { title: 'River Flows In You', artist: 'Yiruma' },
    { title: 'Gymnopedie No. 1', artist: 'Erik Satie' },
    { title: 'Time', artist: 'Hans Zimmer' },
    { title: 'Nuvole Bianche', artist: 'Ludovico Einaudi' }
  ],
  party: [
    { title: 'Uptown Funk', artist: 'Bruno Mars' },
    { title: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake' },
    { title: '24K Magic', artist: 'Bruno Mars' },
    { title: 'Danza Kuduro', artist: 'Don Omar' },
    { title: 'Timber', artist: 'Pitbull' },
    { title: 'Cheap Thrills', artist: 'Sia' },
    { title: 'Despacito', artist: 'Luis Fonsi' },
    { title: 'Yeah!', artist: 'Usher' }
  ],
  nusrat: [
    { title: 'Dard Rukta Nahin Ek Pal Bhi', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Akhiyan Udeek Diyan', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Sanu Ek Pal Chain Na Aave', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Mere Rashke Qamar', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Tumhein Dillagi Bhool Jani Padegi', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Afreen Afreen', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Yeh Jo Halka Halka Suroor Hai', artist: 'Nusrat Fateh Ali Khan' },
    { title: 'Kinna Sohna Tenu Rab Ne Banaya', artist: 'Nusrat Fateh Ali Khan' }
  ],
  hindiGhazal: [
    { title: 'Hoshwalon Ko Khabar Kya', artist: 'Jagjit Singh' },
    { title: 'Tum Itna Jo Muskura Rahe Ho', artist: 'Jagjit Singh' },
    { title: 'Jhuki Jhuki Si Nazar', artist: 'Jagjit Singh' },
    { title: 'Chithi Na Koi Sandesh', artist: 'Jagjit Singh' },
    { title: 'Koi Fariyaad', artist: 'Jagjit Singh' },
    { title: 'Aaj Jaane Ki Zid Na Karo', artist: 'Farida Khanum' },
    { title: 'Ranjish Hi Sahi', artist: 'Mehdi Hassan' },
    { title: 'Chupke Chupke Raat Din', artist: 'Ghulam Ali' }
  ],
  hindiSad: [
    { title: 'Agar Tum Saath Ho', artist: 'Arijit Singh' },
    { title: 'Channa Mereya', artist: 'Arijit Singh' },
    { title: 'Tujhe Kitna Chahne Lage', artist: 'Arijit Singh' },
    { title: 'Phir Bhi Tumko Chaahunga', artist: 'Arijit Singh' },
    { title: 'Hamari Adhuri Kahani', artist: 'Arijit Singh' },
    { title: 'Main Dhoondne Ko Zamaane Mein', artist: 'Arijit Singh' },
    { title: 'Bekhayali', artist: 'Sachet Tandon' },
    { title: 'Tadap Tadap', artist: 'K. K.' }
  ],
  punjabi: [
    { title: '295', artist: 'Sidhu Moose Wala' },
    { title: 'Excuses', artist: 'AP Dhillon' },
    { title: 'Softly', artist: 'Karan Aujla' },
    { title: 'With You', artist: 'AP Dhillon' },
    { title: 'Lover', artist: 'Diljit Dosanjh' },
    { title: 'One Love', artist: 'Shubh' },
    { title: 'Brown Munde', artist: 'AP Dhillon' },
    { title: 'Admirin You', artist: 'Karan Aujla' }
  ],
  himachali: [
    { title: 'Saile Simble Ni Maaye', artist: 'Karnail Rana' },
    { title: 'Patna Deya Taarua', artist: 'Karnail Rana' },
    { title: 'Kajon Nain', artist: 'Karnail Rana' },
    { title: 'Bindu Neelu Do Sakhiyan', artist: 'Karnail Rana' },
    { title: 'Neelu Tera Hasna', artist: 'Karnail Rana' },
    { title: 'Ratno Ni Sun Ratno', artist: 'Karnail Rana' },
    { title: 'Chambe Patne Do Bediyan', artist: 'Karnail Rana' },
    { title: 'Kunju Chanchalo', artist: 'Karnail Rana' }
  ]
};

function getFallbackMood(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes('nusrat') ||
    normalized.includes('fateh ali khan') ||
    normalized.includes('nfak') ||
    normalized.includes('qawwali') ||
    normalized.includes('qawali') ||
    normalized.includes('sufi')
  ) {
    return 'nusrat';
  }

  if (
    normalized.includes('ghazal') ||
    normalized.includes('gazal') ||
    normalized.includes('gajal') ||
    normalized.includes('urdu')
  ) {
    return 'hindiGhazal';
  }

  if (normalized.includes('punjabi') || normalized.includes('sidhu') || normalized.includes('karan aujla') || normalized.includes('ap dhillon') || normalized.includes('diljit')) {
    return 'punjabi';
  }

  if (normalized.includes('himachali') || normalized.includes('pahari') || normalized.includes('karnail') || normalized.includes('karnail rana')) {
    return 'himachali';
  }

  if (normalized.includes('hindi') || normalized.includes('bollywood') || normalized.includes('arijit')) {
    return 'hindiSad';
  }

  if (normalized.includes('work') || normalized.includes('gym') || normalized.includes('energy') || normalized.includes('run')) {
    return 'workout';
  }
  if (normalized.includes('sad') || normalized.includes('cry') || normalized.includes('broken') || normalized.includes('alone') || normalized.includes('truth')) {
    return 'sad';
  }
  if (normalized.includes('focus') || normalized.includes('study') || normalized.includes('relax') || normalized.includes('calm')) {
    return 'focus';
  }
  if (normalized.includes('party') || normalized.includes('dance') || normalized.includes('club') || normalized.includes('fun')) {
    return 'party';
  }

  return 'chill';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  
  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const selectedMood = getFallbackMood(prompt);
    const mockTracks = MOCK_MOOD_PLAYLISTS[selectedMood];
    return NextResponse.json({
      geminiConfigured: false,
      mood: selectedMood,
      tracks: mockTracks,
      message: 'AI Playlist generated successfully using intelligent semantic fallback database. (Add GEMINI_API_KEY inside your .env.local to unlock real-time Gemini generation!)'
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Act as an expert music AI assistant and Spotify playlist curator. 
                  Generate a list of 8 to 10 highly relevant and popular songs that perfectly match this mood or prompt: "${prompt}".
                  If the prompt names an artist, singer, language, genre, or region, prioritize that artist/style strongly and do not switch to unrelated English/global songs.
                  If the prompt asks for "sad ghazals", "sad gazals", "Hindi ghazals", "Hindi sad", "Urdu ghazals", or similar, return real Hindi/Urdu ghazals only from artists like Jagjit Singh, Ghulam Ali, Mehdi Hassan, Pankaj Udhas, Farida Khanum, Chitra Singh, or Talat Aziz.
                  If the prompt names a regional artist such as Karnail Rana or a region/style such as Himachali/Pahari, return songs by that artist/style only, not podcasts, interviews, or unrelated Bollywood/English songs.
                  If the prompt asks for "sad lines", "truth lines", "qawwali", "sufi", or a similar vibe around Nusrat Fateh Ali Khan, return real Nusrat Fateh Ali Khan songs/qawwalis only.
                  Never return unrelated English pop songs when the prompt contains Hindi, Urdu, ghazal/gazal/gajal, qawwali, sufi, or an Indian/Pakistani artist.
                  You MUST return EXACTLY a JSON array of objects. Do not wrap it in markdown block tags like \`\`\`json. Return only the raw JSON.
                  Each object inside the JSON array MUST have exactly these two fields:
                  - "title": (string) The title of the song
                  - "artist": (string) The primary artist of the song
                  
                  Make sure songs are globally or regionally famous and easy to find on JioSaavn or YouTube.`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error('Empty response from Gemini API');
    }

    const tracks = JSON.parse(rawText.trim());
    return NextResponse.json({
      geminiConfigured: true,
      tracks,
      message: `AI Playlist generated in real-time by Google Gemini Flash matching: "${prompt}"!`
    });

  } catch (error: any) {
    console.error('Gemini AI playlist generation failed:', error);
    
    // Graceful error fallback
    return NextResponse.json({
      geminiConfigured: false,
      tracks: MOCK_MOOD_PLAYLISTS[getFallbackMood(prompt)],
      message: 'AI playlist generation encountered a server error. Gracefully loaded the ambient lounge fallback mix.',
      error: error.message
    });
  }
}

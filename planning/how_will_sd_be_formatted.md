# how?

Help me plan how I will need to format my music for my personal mp3 player made from scratch

I am planning how I will format music in my MicroSD card for my MP3 music player. Currently in ESP32 I have dummy data of Albums and Playlists (Categories ALL_SONGS and Artists are made programmaticly when this is loaded in which probably isn't very efficient)

We have Playlists, Albums, Artists and All_Songs

Currently we get from Playlist and Albums. We have code to Assign Artist and All_Songs programmatically.

BUT. Is this the best approach.

We Know a Song Must have a SongName, artistName, AlumNAme and PlaylistName (optional).

So theoretically if the SD card just had all songs with this data in the title it would be fine and simple.

This however sounds shit.

---

The Issue is if I want to have  Playlists, Albums, Artists and All_Songs folders in the SD card how can I format to be that way?

You could Argue I could place all songs into a folder with suitable metadata and assign pointers in tehTauri Application and in ESP32 application but would this work.

What is the most simple and efficient approach. Give me alternatives and pros and cons

# How Files are Stored in the SD card

SD card structure:

```
/jp3/
├── music/
│   ├── 00/           # Bucket 0 (songs 0-255)
│   │   ├── 000.mp3
│   │   ├── 001.mp3
│   │   └── ...
│   ├── 01/           # Bucket 1 (songs 256-511)
│   └── ...
├── metadata/
│   └── library.bin   # Main library database
└── playlists/
    ├── 0.bin          # Playlist ID 0
    ├── 1.bin          # Playlist ID 1
    └── ...
```

**Notes:**
- Music files bucketed into subfolders (256 files per bucket) for efficient SD reads
- Playlists stored as separate binary files, not a single folder
- No file duplication - playlists reference song IDs

This is what library.bin looks like:

```
LibraryHeader (48 bytes) {
  magic = "LIB1",
  version = 1,
  song_count = 1,
  artist_count = 1,
  album_count = 1,

  string_table_offset = 0x0030,           // 48 bytes
  artist_table_offset = 0x0030,
  album_table_offset  = 0x0030,
  song_table_offset   = 0x0030,
  album_song_index_table_offset = 0x0030,  // Added in v2
  artist_song_index_table_offset = 0x0030, // Added in v2
  reserved = 0
}

ArtistEntry (8 bytes) {
  name_string_id = 0,   // "Paul Simon"
  reserved = 0
}

AlbumEntry (16 bytes) {
  name_string_id = 1,   // "Still Crazy After All These Years"
  artist_id = 0,       // Paul Simon
  year = 1975,
  reserved = 0
}

SongEntry (24 bytes) {
  title_string_id = 1,
  artist_id = 0,
  album_id = 0,
  path_string_id = 2,    // "00/001.mp3" (relative to jp3/music/)
  track_number = 1,
  duration_sec = 215,
  flags = 0x00,          // 0x00 = active, 0x01 = deleted (soft delete)
  reserved = 0
}

AlbumSongIndexEntry (8 bytes) - Added in v2 {
  song_count = 10,        // Number of songs in this album
  first_song_pos = 5,      // Index position of first song in song table
  reserved = 0             // Padding for alignment
}

ArtistSongIndexEntry (8 bytes) - Added in v2 {
  song_count = 25,        // Number of songs by this artist
  first_song_pos = 0,     // Index position of first song in song table
  reserved = 0             // Padding for alignment
}

StringTable {
  [0] = "Paul Simon"
  [1] = "Still Crazy after All of these Years"
  [2] = "00/001.mp3"
}
```

**Why the Index Tables?**
- Loading songs by album/artist previously required O(N) scan of ALL songs
- Now: O(1) lookup using the index tables
- ESP32 calculates byte offset: `first_song_pos * 24` (SongEntry size)

**String Table Format:** Each string is prefixed with a 2-byte length (u16), then UTF-8 bytes.

**Key Features:**
- No File Duplication
- Playlists are References by Song ID
- Albums and Artists and All Songs are easily derived
- Soft delete support via flags field (songs marked deleted, not removed)
- String deduplication for storage efficiency
- Bucketed music files for faster SD reads
- **Album/Artist Song Index Tables (v2):** O(1) lookup for loading songs by album/artist

# How ESP32 Parses the Library

```pseudo
// 1️⃣ Open library file
file = SD.open("/jp3/metadata/library.bin")

// 2️⃣ Read header (40 bytes)
header = file.read_struct(LibraryHeader)

// 3️⃣ Load fixed-size tables into RAM
artists = file.read_array(ArtistEntry, header.artist_count, header.artist_table_offset)
albums  = file.read_array(AlbumEntry,  header.album_count,  header.album_table_offset)

// 4️⃣ For songs, calculate offsets (SongEntry = 24 bytes each)
song_count = header.song_count
song_offsets = []
for i = 0 to song_count-1:
    offset = header.song_table_offset + i * 24  // SongEntry SIZE
    song_offsets.append(offset)

// 5️⃣ Function to load a SongEntry lazily
function load_song(song_id):
    file.seek(song_offsets[song_id])
    return file.read_struct(SongEntry)

// 6️⃣ Function to load a string from string table
function load_string(string_id):
    file.seek(header.string_table_offset)
    for i = 0 to string_id-1:
        len = file.read_uint16()        // skip previous strings
        file.seek(len, SEEK_CUR)
    len = file.read_uint16()
    return file.read_bytes(len)

// 7️⃣ Example: list all artists
function list_artists():
    for artist in artists:
        name = load_string(artist.name_string_id)
        print(name)

// 8️⃣ Example: list albums for a given artist
function list_albums(artist_id):
    for album_id, album in enumerate(albums):
        if album.artist_id == artist_id:
            name = load_string(album.name_string_id)
            print(name)

// 9️⃣ Example: list songs for an album (skip deleted)
function list_songs(album_id):
    for song_id in 0 to song_count-1:
        song = load_song(song_id)
        if song.album_id == album_id and song.flags == 0x00:  // Skip deleted
            title = load_string(song.title_string_id)
            print(title)

// 🔟 Example: play song
function play_song(song_id):
    song = load_song(song_id)
    path = load_string(song.path_string_id)
    full_path = "/jp3/music/" + path    // e.g., "/jp3/music/00/001.mp3"
    audio_file = SD.open(full_path)
    audio_play(audio_file)
```

## Using Index Tables for O(1) Album/Artist Song Lookup

The index tables allow ESP32 to find songs for an album or artist in O(1) time instead of O(N) scan.

```pseudo
// 1️⃣ Load index tables into RAM (after loading artists/albums)
album_song_index = file.read_array(AlbumSongIndexEntry, header.album_count, header.album_song_index_table_offset)
artist_song_index = file.read_array(ArtistSongIndexEntry, header.artist_count, header.artist_song_index_table_offset)

// 2️⃣ Example: list songs for an album - O(1) instead of O(N)!
function list_songs_for_album(album_id):
    index_entry = album_song_index[album_id]     // Direct lookup
    song_count = index_entry.song_count
    first_pos = index_entry.first_song_pos
    
    // Direct access - no scanning needed
    for i = 0 to song_count - 1:
        song_id = first_pos + i                  // Calculate position
        song = load_song(song_id)
        title = load_string(song.title_string_id)
        print(title)

// 3️⃣ Example: list songs for an artist - O(1) lookup!
function list_songs_for_artist(artist_id):
    index_entry = artist_song_index[artist_id]  // Direct lookup
    song_count = index_entry.song_count
    first_pos = index_entry.first_song_pos
    
    for i = 0 to song_count - 1:
        song_id = first_pos + i
        song = load_song(song_id)
        title = load_string(song.title_string_id)
        print(title)
```

**Before (v1):** Scan all songs to find matching album_id/artist_id = O(N)
**After (v2):** Direct index lookup = O(1)

The ESP32 calculates byte offset: `song_offset = first_song_pos * 24` (SongEntry size is 24 bytes)

## Reading Playlists

```pseudo
// 1️⃣ List playlist files
playlist_dir = SD.open("/jp3/playlists/")
while (entry = playlist_dir.open_next_file()):
    if entry.is_file() and entry.name.ends_with(".bin"):
        playlist_id = parse_int(entry.name)
        playlist = load_playlist(playlist_id)
        print(playlist.name, "has", playlist.song_count, "songs")

// 2️⃣ Load a single playlist
function load_playlist(playlist_id):
    file = SD.open("/jp3/playlists/" + playlist_id + ".bin")
    
    // Read header (14 bytes)
    magic = file.read_bytes(4)      // "PLY1"
    version = file.read_uint32()
    song_count = file.read_uint32()
    name_length = file.read_uint16()
    
    // Read name
    name = file.read_bytes(name_length)
    
    // Read song IDs
    song_ids = []
    for i = 0 to song_count-1:
        song_ids.append(file.read_uint32())
    
    return { id: playlist_id, name, song_ids }
```
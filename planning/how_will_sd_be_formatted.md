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

What is the most efficient and makes the most since.

in sdCard:

```
/music ( this will likely be broken into sub folders like music/00/ music/01/ as SD reads work better in smaller groups)
/metadata/
|
----> library.bin 
/playlists/
----> chill.bin
----> playlist1.bin

```

This way ther eis :
- No File Duplication
- Playlists are References
- Albums and Artists and All Songs are easily derived

This is what library.bin would look like:

```
LibraryHeader {
  magic = "LIB1",
  version = 1,
  song_count = 1,
  artist_count = 1,
  album_count = 1,

  string_table_offset = 0x0030,
  artist_table_offset = 0x0008,
  album_table_offset  = 0x0010,
  song_table_offset   = 0x0020
}

ArtistEntry {
  name_string_id = 0;   // "Paul Simon"
}

AlbumEntry {
  name_string_id = 1;   // "Still Crazy After All These Years"
  artist_id = 0;        // Paul Simon
  year = 1975;
}

SongEntry {
  title_string_id = 1;
  artist_id = 0;
  album_id = 0;
  path_string_id = 2;
  track_number = 1;
  duration_sec = 215;
}
```

This is way it removes duplicates which is highly necessary for syncing. Playlist would be referincing songs that would be associated with it.

The way this binary file will be set up will make alot easier for the esp32 to parse. Due to small RAM size I may have to load in song bins at like 300 at a time. Though I don't think I will ever reach that number regardless.

To format this Tauri will do all of the heavy lifting. This is approach is similair to how old iPods stored there music.



# How ESP discovers them and indexes them

```pseudo
// 1️⃣ Open library file
file = SD.open("/metadata/library.bin")

// 2️⃣ Read header
header = file.read_struct(LibraryHeader)

// 3️⃣ Load fixed-size tables into RAM
artists = file.read_array(ArtistEntry, header.artist_count, header.artist_table_offset)
albums  = file.read_array(AlbumEntry,  header.album_count,  header.album_table_offset)

// For songs, store only offsets or IDs
// We'll load SongEntry lazily
song_count = header.song_count
song_offsets = []
for i = 0 to song_count-1:
    offset = header.song_table_offset + i * sizeof(SongEntry)
    song_offsets.append(offset)

// 4️⃣ Function to load a SongEntry lazily
function load_song(song_id):
    file.seek(song_offsets[song_id])
    return file.read_struct(SongEntry)

// 5️⃣ Function to load a string lazily
function load_string(string_id):
    file.seek(header.string_table_offset)
    for i = 0 to string_id-1:
        len = file.read_uint16()        // skip previous strings
        file.seek(len, SEEK_CUR)
    len = file.read_uint16()
    return file.read_bytes(len)

// 6️⃣ Example: list all artists
function list_artists():
    for artist in artists:
        name = load_string(artist.name_string_id)
        print(name)

// 7️⃣ Example: list albums for a given artist
function list_albums(artist_id):
    for album_id, album in enumerate(albums):
        if album.artist_id == artist_id:
            name = load_string(album.name_string_id)
            print(name)

// 8️⃣ Example: list songs for a given album
function list_songs(album_id):
    for song_id in 0 to song_count-1:
        song = load_song(song_id)
        if song.album_id == album_id:
            title = load_string(song.title_string_id)
            print(title)

// 9️⃣ Example: play song. Probably not load the whole song in and will play it in buffer I would assume!
function play_song(song_id):
    song = load_song(song_id)
    path = load_string(song.path_string_id)
    audio_file = SD.open(path)
    audio_play(audio_file)


```
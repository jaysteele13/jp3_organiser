## Summary

This Application is to be a lightweight file organiser and local mp3 player.

This application will take songs and load them into a file /jp3

These will be sorted by:
music/
metatdata/library.bin
playlists/<playlist1>.bin, <playlist2>.bin etc.

There will be a pipeline to ensure metadata is correctly extracted as these files will be formatted in such a way to make them highly efficient to parse.

The ideal purpose is to transfer these music files into an SD card then my ESP32 mp3 player will be programmed to expect the binary file and files then play them.

However. Because of this, this application can also be dual purpose. You can save the songs and also play them on this application.

The sections so far are going to be

Home (put about me links to GH and other stuff)
Upload (place to upload Files that go through many steps and parsing)
View (See what is in /jp3/ device)
Play (acts as mp3 player client for computer where we can play what is jp3 file)

SideNote:

'Detect if MicroSD and mention the limited Write Cycles (dk how many or if there is a way to check this)'


## This Software will be great and industry practice

I want to:
- experiment
- create a sleek application tthat can be installed through debian package manager
- lightweight create with a RUST backend and maybe a react front end if this is lightweight (Tauri) 

## What Features will it have.

Must have a feature to ensure we get songs and know their metadata. Each Song must have a:
- songName
- album
- artist

As there may be many songs only from 1 album when looking for an album I will make a sorting feature:
- alphabetical
- > 1 song

In Tauri Application

Option to Add Album of songs, Songs in Bulk (or singular), Add Playlist (adds songs to albums and artists as well but has references to a playlist).

Adding alot of songs would be nice but to actually sort them in the Tauri Applcation will be hard. I could either:
- force the user to give the file a name like song-album-artist.mp3
- use AI or open source song API to gather the songName and assiogn it metadata (if not a match ask for clarification)
- some other alternative chat gpt suggests?

Upload Flow:
A hybrid:

1. Create a filter to ensure file type is compatible like .mp3, .wav etc. Assign each file a temporaryInternalID for tracking.
2. Most music files have an ID3 tag with music metadata like node-id3, ifg all required fields are present mark as metadata-complete, if not -> metadata-incomplete and move on to the next section
3. Use Quantized AI model to extract fileName does this sound like a name, artist or album, using this. Perhaps do a look up for free opensource music checker. If we find a match and has high confidence apply metadata if not move on:
4. Ask user for manual confirmation go through the ones we couldn't find for and get manual input. Here have validation to ensure that the strings in the sd card are the same e.g. cant do queen and Queen. (Drop down of bands that exist). Unless we make strings with the same name and different capitals just be associated to the same band.
5. For all the song input have a duplicate checker flag songs that may be duplicates for an air tight system
6. Before we save we must remove illegal filename characters like ' i believe with a percentage. Trim whitespace also



Run `xxd jp3/metadata/library.bin ` to get Hex Dump of binary File. Te Parsing and duplicate checking is now working in seprate batches.
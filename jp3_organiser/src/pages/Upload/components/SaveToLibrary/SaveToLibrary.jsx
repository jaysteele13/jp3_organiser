/**
 * SaveToLibrary Component
 * 
 * Displays the "Ready to Save" stage of the upload workflow.
 * Shows confirmed files and provides save/back/reset actions.
 * 
 * Playlist modes:
 * - New playlist (playlistId = null): Uses save_to_playlist which saves songs 
 *   to library AND creates a new playlist with those songs.
 * - Existing playlist (playlistId = number): Saves songs to library, then adds
 *   the returned song IDs to the existing playlist.
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 * @param {Object} props.workflow - Workflow machine instance
 * @param {Object} props.toast - Toast instance from parent
 */

import React, { useState, useCallback } from 'react';
import { saveToLibrary, saveToPlaylist, addSongsToPlaylist, MetadataStatus, setMbids, hasMbid, searchAlbumMbidsBatch, setArtistMbid } from '../../../../services';
import { useUploadCache } from '../../../../hooks';
import { UPLOAD_MODE } from '../../../../utils';
import styles from './SaveToLibrary.module.css';

export default function SaveToLibrary({ libraryPath, workflow, toast }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const cache = useUploadCache();
  const { confirmedFiles, removeConfirmedFiles, clearAll, uploadMode, uploadContext } = cache;
  
  const isPlaylistMode = uploadMode === UPLOAD_MODE.PLAYLIST;
  const playlistName = uploadContext?.playlist;
  const playlistId = uploadContext?.playlistId;
  const isExistingPlaylist = isPlaylistMode && playlistId !== null;

  /**
   * Store MBIDs for albums after saving to library.
   * 
   * Uses MusicBrainz search to find accurate MBIDs based on artist+album name.
   * Falls back to AcoustID MBID if MusicBrainz search fails.
   * Skips albums that already have an MBID stored to avoid redundant API calls.
   * 
   * @param {Array} filesToSave - Files that were saved
   */
  const storeMbids = useCallback(async (filesToSave) => {
    if (!filesToSave || filesToSave.length === 0) {
      return;
    }

    // Build maps of unique albums and artists with their MBIDs
    const uniqueAlbums = new Map();
    const uniqueArtists = new Map();

    for (const file of filesToSave) {
      const artist = file.metadata?.artist;
      const album = file.metadata?.album;
      const releaseMbid = file.metadata?.releaseMbid;  // Renamed for clarity
      const artistMbid = file.metadata?.artistMbid;    // Renamed for clarity

      if (!artist) continue;  // Skip if no artist

      // Store unique albums (only if album exists)
      if (album) {
        const key = `${artist}|||${album}`;
        if (!uniqueAlbums.has(key)) {
          uniqueAlbums.set(key, { artist, album, releaseMbid });
        }
      }

      // Store unique artists (even without album)
      if (artistMbid && !uniqueArtists.has(artist)) {
        uniqueArtists.set(artist, artistMbid);
      }
    }

    // Store artist MBIDs (call a setter in mbidStore)
    for (const [artist, artistMbid] of uniqueArtists) {
      await setArtistMbid(artist, artistMbid);  // Assuming this function exists in mbidStore
    }

    if (uniqueAlbums.size === 0) {
      return;  // No albums to process
    }

    // Filter out albums that already have anMBID stored
    const albumList = Array.from(uniqueAlbums.values());
    const albumsToSearch = [];
    
    for (const albumInfo of albumList) {
      const exists = await hasMbid(albumInfo.artist, albumInfo.album);
      if (exists) {
        console.log(`[SaveToLibrary] MBID already cached for "${albumInfo.album}" by "${albumInfo.artist}" - skipping`);
      } else {
        albumsToSearch.push(albumInfo);
      }
    }
    
    if (albumsToSearch.length === 0) {
      console.log('[SaveToLibrary] All albums already have MBIDs cached');
      return;
    }

    // Prepare queries for batch MusicBrainz search
    const queries = albumsToSearch.map(({ artist, album }) => ({ artist, album }));
    
    // Search MusicBrainz for albums without cached MBIDs
    let searchResults = [];
    try {
      searchResults = await searchAlbumMbidsBatch(queries);
    } catch (err) {
      console.error('[SaveToLibrary] MusicBrainz batch search failed:', err);
      // Fall back to AcoustID MBIDs only
      searchResults = queries.map(() => ({ found: false }));
    }

    // Build entries for mbidStore, preferring MusicBrainz results
    // Also store the AcoustID MBID as a fallback for Cover Art Archive lookups
    const entries = [];
    for (let i = 0; i < albumsToSearch.length; i++) {
      const { releaseMbid, artist, album } = albumsToSearch[i];
      const searchResult = searchResults[i];
      
      // Prefer MusicBrainz MBID, fall back to AcoustID MBID
      let mbid = null;
      let acoustidMbid = releaseMbid || null; // AcoustID release MBID from fingerprinting
      let source = null;
      
      if (searchResult?.found && searchResult.mbid) {
        mbid = searchResult.mbid;
        source = 'MusicBrainz';
      } else if (acoustidMbid) {
        mbid = acoustidMbid;
        acoustidMbid = null; // Don't store as fallback if it's the primary
        source = 'AcoustID';
      }
      
      if (mbid) {
        entries.push({ artist, album, mbid, acoustidMbid });
        console.log(`[SaveToLibrary] MBID for "${album}" by "${artist}": ${mbid} (source: ${source})${acoustidMbid ? `, fallback: ${acoustidMbid}` : ''}`);
      } else {
        console.log(`[SaveToLibrary] No MBID found for "${album}" by "${artist}"`);
      }
    }
    
    if (entries.length > 0) {
      await setMbids(entries);
    }
  }, []);

  const handleSaveToLibrary = useCallback(async () => {
    if (!libraryPath) {
      setSaveError('Library path not configured');
      return;
    }

    const filesToSave = confirmedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (filesToSave.length === 0) {
      setSaveError('No complete files to add');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const files = filesToSave.map(f => ({
        sourcePath: f.filePath,
        metadata: f.metadata,
      }));

      let message;
      
      if (isExistingPlaylist) {
        // Existing playlist mode: save to library, then add songs to playlist
        const libraryResult = await saveToLibrary(libraryPath, files);
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave);
        
        // Combine newly saved songs AND duplicate songs (which already exist in library)
        // Both should be added to the playlist
        const allSongIds = [
          ...(libraryResult.songIds || []),
          ...(libraryResult.duplicateSongIds || []),
        ];
        
        if (allSongIds.length > 0) {
          await addSongsToPlaylist(libraryPath, playlistId, allSongIds);
        }
        
        const newSongsCount = libraryResult.songIds?.length || 0;
        const duplicatesCount = libraryResult.duplicateSongIds?.length || 0;
        
        message = `Added ${allSongIds.length} song(s) to playlist "${playlistName}". `;
        
        if (newSongsCount > 0) {
          message += `${libraryResult.artistsAdded} artist(s), ${libraryResult.albumsAdded} album(s) added to library. `;
        }
        
        if (duplicatesCount > 0) {
          message += `${duplicatesCount} existing song(s) also added to playlist.`;
        }
      } else if (isPlaylistMode && playlistName) {
        // New playlist mode: save to library AND create playlist
        const result = await saveToPlaylist(libraryPath, playlistName, files);
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave);
        
        message = `Created playlist "${result.playlistName}" with ${result.songsAdded} song(s). ` +
          `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s).`;
        
        if (result.duplicatesSkipped > 0) {
          message += ` ${result.duplicatesSkipped} skipped.`;
        }
      } else {
        // Normal mode: save to library only
        const result = await saveToLibrary(libraryPath, files);
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave);
        
        message = `Added ${result.filesSaved} file(s) to library. ` +
          `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`;
        
        if (result.duplicatesSkipped > 0) {
          message += ` ${result.duplicatesSkipped} duplicate(s) skipped.`;
        }
      }

      toast.showToast(message, 'success');
      removeConfirmedFiles();
      workflow.saveComplete();
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, confirmedFiles, removeConfirmedFiles, workflow, toast, isPlaylistMode, isExistingPlaylist, playlistName, playlistId, storeMbids]);

  const handleBackToReview = useCallback(() => {
    const startIndex = confirmedFiles.findIndex(f => !f.isConfirmed);
    workflow.backToReview(startIndex >= 0 ? startIndex : 0);
  }, [workflow, confirmedFiles]);

  const handleReset = useCallback(() => {
    clearAll();
    toast.hideToast();
    setSaveError(null);
  }, [clearAll, toast]);

  return (
    <div className={styles.completeContainer}>
      <div className={styles.completeHeader}>
        <h3 className={styles.completeTitle}>
          {isExistingPlaylist 
            ? 'Ready to Add to Playlist'
            : isPlaylistMode 
              ? 'Ready to Create Playlist' 
              : 'Ready to Add to Library'
          }
        </h3>
        <p className={styles.completeMessage}>
          {isExistingPlaylist
            ? `${confirmedFiles.length} file(s) will be added to playlist "${playlistName}".`
            : isPlaylistMode 
              ? `${confirmedFiles.length} file(s) will create a new playlist "${playlistName}".`
              : `${confirmedFiles.length} file(s) confirmed and ready to be added.`
          }
        </p>
      </div>

      {saveError && (
        <div className={styles.errorMessage}>{saveError}</div>
      )}

      <div className={styles.completeActions}>
        <button
          className={styles.saveButton}
          onClick={handleSaveToLibrary}
          disabled={isSaving}
        >
          {isSaving 
            ? 'Saving...' 
            : isExistingPlaylist
              ? `Add ${confirmedFiles.length} Song(s) to Playlist`
              : isPlaylistMode
                ? `Create Playlist with ${confirmedFiles.length} Song(s)`
                : `Add ${confirmedFiles.length} File(s) to Library`
          }
        </button>

        <button
          className={styles.backButton}
          onClick={handleBackToReview}
          disabled={isSaving}
        >
          Back to Review
        </button>

        <button
          className={styles.resetButton}
          onClick={handleReset}
          disabled={isSaving}
        >
          Start Over
        </button>
      </div>

      {/* Confirmed files list */}
      <div className={styles.confirmedList}>
        <h4 className={styles.confirmedListTitle}>
          {isPlaylistMode ? `Songs for "${playlistName}":` : 'Confirmed Files:'}
        </h4>
        <ul className={styles.fileList}>
          {confirmedFiles.map(file => (
            <li key={file.trackingId} className={styles.fileItem}>
              <span className={styles.fileName}>
                {file.metadata?.title || file.fileName}
              </span>
              <span className={styles.fileMeta}>
                {file.metadata?.artist} - {file.metadata?.album}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

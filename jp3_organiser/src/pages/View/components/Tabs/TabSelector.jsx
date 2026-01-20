import styles from './TabSelector.module.css'
import ModeImage from '../../../Upload/components/UploadModeSelector/ModeImage';

import { TAB_IMAGES } from '../../../../utils/enums';
export default function TabSelector({setActiveTab, activeTab, tabs }) {

    /*
    How can I work this: export const TAB_IMAGES = {
      [TABS.SONGS]: {still: 'song_still.png', gif_w: 'song_w_noBG.gif', gif_b: 'song_noBG.gif'},
      [TABS.ALBUMS]: {still: 'album_still.png', gif_w: 'album_w_noBG.gif', gif_b: 'album_noBG.gif'},
      [TABS.ARTISTS]: {still: 'artist_still.png', gif_w: 'artist_w_noBG.gif', gif_b: 'artist_noBG.gif'},
      [TABS.PLAYLISTS]: {still: 'playlist_still.png', gif_w: 'playlist_w_noBG.gif', gif_b: 'playlist_noBG.gif'}
    }

    so based on current tab I will make the image animated. We can use this enum to at all times use the previosuly created component
    and also specify if we want it black or white

    We should be able to use jp3_organiser/src/pages/Upload/components/UploadModeSelector/ModeImage.jsx from upload and make this resuable as we will be doing
    the same thing for the player later.

    So I want to ammend tabSelector for View page to use ModeImage component and swap still/gif based on active tab rather than the current word system can you implment this?


    */

    return (
         <div className={styles.tabs}>
                        {Object.entries(tabs).map(([key, value]) => {
                                const tabKey = key.toUpperCase();
                                const images = TAB_IMAGES[tabKey];
                                const playing = activeTab === value;

                                // Guard: if no images defined for this tab, fallback to text-only
                                if (!images) {
                                    return (
                                        <button
                                            key={value}
                                            className={`${styles.tab} ${activeTab === value ? styles.tabActive : ''}`}
                                            onClick={() => setActiveTab(value)}
                                        >
                                            <span>{key.charAt(0) + key.slice(1).toLowerCase()}</span>
                                        </button>
                                    );
                                }

                                // choose white or black gif depending on active state (using active -> white)
                                const gif = images.gif_b;
                                const still = images.still_b;

                                return (
                                    <button
                                        key={value}
                                        className={`${styles.tab} ${activeTab === value ? styles.tabActive : ''}`}
                                        onClick={() => setActiveTab(value)}
                                    >
                                        <ModeImage still={still} gif={gif} alt={key} className={styles.tabImage} playing={playing} />
                                        {/* <span>{key.charAt(0) + key.slice(1).toLowerCase()}</span> */}
                                    </button>
                                )
                        })}
        </div>
    )
}
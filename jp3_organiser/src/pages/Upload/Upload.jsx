
import React from 'react'
import Header from '../../components/Header'
import UploadFile from './components/UploadFile' 
// this is a place for where to upload FileSystem. With some advice about having atleast the song name on the mp3. If not there will be work arounds 
// use extensive datasets, ID3 transformImage, APIs and AIs. If they can't find it we will ask you to clear up some things

export default function Upload() {


    return (
        <>
            <Header
            title={"Upload Music"}
            description={"Where you upload Files Prick"}/>

            <UploadFile/>


        </>
    )
}
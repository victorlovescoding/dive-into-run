//這個檔案專門拿資料
import {db} from '@/lib/firebase-client'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
export async function loginCheckUserData(fbUser){
    try{
        const docRef = doc(db, "users", fbUser.uid);
        const docSnap = await getDoc(docRef);
        //預計把有資料的狀況刪除，拿資料的工作交給watchUserProfile
        if (!docSnap.exists()){
        // docSnap.data() will be undefined in this case
        console.log("No such document!");
        //資料庫沒有使用者資料就要新增一個document
        const newUser = {
        name: fbUser.displayName,
        email: fbUser.email,
        uid: fbUser.uid,
        photoURL:fbUser.photoURL,
        createdAt: serverTimestamp()
        }
        await setDoc(docRef, newUser,{merge:true});
        }
    }catch(error){
        console.log(error);
        throw error
    }

}

export async function updateUserName(uid,newUserName){
    const safeName = (newUserName ?? '').trim()
    if(!uid){throw new Error('沒有uid')}
    if(!safeName){throw new Error('沒有名字')}
    //更新資料庫
    await setDoc(doc(db,'users',uid),{name:safeName, nameChangedAt:serverTimestamp()},{merge:true})//setDoc第一個參數是整份文件而不是name
}

//這裡要再一個監聽的function
export function watchUserProfile(uid, onData, onError){//onData是發現資料更改時要做的事情
    if (!uid) throw new Error('uid required')
    //onSnapshot要在登出/離開/刷新/關分頁時做清理
    const ref = doc(db, 'users', uid)
    const unSubProfile = onSnapshot(ref,
    (snap)=>{
        onData?.(snap.data()??null)
    },
    (err)=>{
        onError?.(err)
    }
)
    return unSubProfile
}

//把拿到的檔案壓縮並且傳到Storage，最後呼叫 getDownloadURL(ref) 拿到檔案的網址
export async function uploadUserAvatar(file, uid){
//File解碼成bitmap
const imageBitmap = await window.createImageBitmap(file)
//用ImageBitmap來把圖片畫到canvas上
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
const maxSize = 512
const originWidth = imageBitmap.width
const originHeight = imageBitmap.height
let targetWidth = originWidth
let targetHeight = originHeight
// 如果大於 maxSize，就等比例縮小
if (originWidth > originHeight) {
    if (originWidth > maxSize) {
        targetWidth = maxSize
        targetHeight = Math.round(originHeight * (maxSize / originWidth))
    }
    } else {
    if (originHeight > maxSize) {
        targetHeight = maxSize
        targetWidth = Math.round(originWidth * (maxSize / originHeight))
    }
}
canvas.width = targetWidth
canvas.height = targetHeight
//壓縮畫質
ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)
//轉回去blob並且壓縮檔案來暫存
const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
        if (b) resolve(b)       // 成功 → 把結果交給 resolve
        else reject(new Error("toBlob 失敗")) // 失敗 → 交給 reject
    })
})
const storage = getStorage()
// 固定檔名覆蓋，避免累積舊檔
const storageRef = ref(storage, `users/${uid}/avatar.png`)
// 先確保上傳完成，再取下載網址
await uploadBytes(storageRef, blob, { contentType: 'image/png' })
console.log('Uploaded a blob or file!')
const url = await getDownloadURL(storageRef)
  // 加版本參數，擊穿瀏覽器/CDN 快取
const bustUrl = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now()
return bustUrl
}

//拿著新的url更新firestore的網址
export async function updateUserPhotoURL(url, uid){
    if(!url){throw new Error('沒有url')}
    if(!uid){throw new Error('沒有uid')}
    await setDoc(
    doc(db, 'users', uid),
    { photoURL: url, photoUpdatedAt: serverTimestamp() },
    { merge: true },
)
}
//onSnapshot 少了「拿資料的回呼」，這樣不會把任何資料丟回來。
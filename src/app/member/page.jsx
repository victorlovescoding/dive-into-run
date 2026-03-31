'use client';

// 為何要 "use client": 這個頁面要使用 React 的 useContext（只在 Client 端可用），
// 並讀取瀏覽器端還原的登入狀態，所以必須是 Client Component。

import { useContext, useEffect, useState, useRef } from 'react';
// import { useRouter } from 'next/navigation'
import Image from 'next/image';
import { AuthContext } from '@/contexts/AuthContext';
import { updateUserName, uploadUserAvatar, updateUserPhotoURL } from '@/lib/firebase-users';

/**
 *
 */
export default function MemberPage() {
  // 為何要從 Context 讀 user：Firebase SDK 會在背景非同步還原登入，
  // 還原完成後 AuthProvider 會把 user 放進 Context，這裡直接取用即可。
  const { user, loading } = useContext(AuthContext);
  const [name, setName] = useState('');
  const inputFileRef = useRef(null);

  // 用useEffect是因為後續拿到user後，需要更新name
  useEffect(() => {
    if (user) {
      setName(user.name);
    } else {
      setName('');
    }
  }, [user]);
  /**
   *
   * @param e
   */
  function onNameChange(e) {
    setName(e.target.value);
  }

  /**
   *
   */
  function triggerFilePicker() {
    if (user) {
      inputFileRef.current?.click();
    } else {
    }
  }
  /**
   *
   * @param e
   */
  async function onAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      // 1) 上傳並「接住」回傳的 URL（這裡就用到你在 firebase-users.js 的 return url）
      const url = await uploadUserAvatar(file, user.uid);

      // 2) 把 URL 寫回 Firestore
      await updateUserPhotoURL(url, user.uid);
    } catch (err) {
      console.error(err);
    } finally {
      // 允許選同一張圖再次觸發
      e.target.value = '';
    }
  }

  /**
   *
   * @param e
   */
  async function onSubmitNewName(e) {
    e.preventDefault(); // 避免重新整理影響後續更新資料庫
    // 如果使用者沒有登入或是還在loading 不可以送出
    if (!user || loading) {
      return;
    }
    // 檢查使用者輸入的字是否有問題並且要刪除空白
    const safeName = (name ?? '').trim();
    if (!safeName || safeName === (user.name ?? '')) return;
    // 預計在這裡call changeName function 到資料庫更新名字
    try {
      await updateUserName(user.uid, safeName);
      console.log(user.photoURL);
    } catch (err) {
      console.error(err);
    }
  }
  return (
    <div>
      <h1>這是會員頁面</h1>
      <h2>
        hello
        {user?.name || user?.email || '跑者'}
      </h2>
      <div>
        <Image
          onClick={triggerFilePicker}
          src={user?.photoURL || '/default-avatar.png'}
          alt={user?.name || '大頭貼'}
          width={50}
          height={50}
        />
        <input
          hidden
          type="file"
          accept="image/*"
          ref={inputFileRef}
          onChange={onAvatarFileChange}
        />
        <form action="" onSubmit={onSubmitNewName}>
          <input type="text" value={name || ''} onChange={onNameChange} />
          <button type="submit">變更名稱</button>
        </form>
      </div>
    </div>
  );
}

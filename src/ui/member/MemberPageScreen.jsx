'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * member page UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - member runtime boundary。
 * @param {import('react').ReactNode} props.bioEditor - bio editor slot。
 * @param {import('react').ReactNode} props.dashboardTabs - dashboard tabs slot。
 * @returns {import('react').ReactElement} member page UI。
 */
export default function MemberPageScreen({ runtime, bioEditor, dashboardTabs }) {
  const {
    user,
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
  } = runtime;

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
        <form onSubmit={onSubmitNewName}>
          <input type="text" value={name || ''} onChange={onNameChange} />
          <button type="submit">變更名稱</button>
        </form>
      </div>
      {user && (
        <p>
          <Link href={`/users/${user.uid}`}>查看我的公開檔案</Link>
        </p>
      )}
      {bioEditor}
      {dashboardTabs}
    </div>
  );
}

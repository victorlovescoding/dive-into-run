'use client';

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useContext, useEffect, useState } from 'react';
import { provider, auth } from '../../lib/firebase-client';
import { AuthContext } from '@/contexts/AuthContext';

/**
 *
 */
export default function LoginButton() {
  const { setUser, user, loading } = useContext(AuthContext); // 在元件最上層取用
  const [busy, setBusy] = useState(false);
  // const [ isLoginButton, setIsLoginButton ] = useState(true)
  /**
   *
   */
  function LoginButtonHandler() {
    setBusy(true);
    signInWithPopup(auth, provider)
      .then((result) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;
        // The signed-in user info.
        const { user } = result;
        // IdP data available using getAdditionalUserInfo(result)
        // ...
        console.log(user);
        setBusy(false);
        // setUser({
        //     userName:user.displayName,
        //     userEmail:user.email
        // })
      })
      .catch((error) => {
        console.log(error);
        setBusy(false);
        // Handle Errors here.
        // const errorCode = error.code;
        // const errorMessage = error.message;
        // The email of the user's account used.
        // const email = error.customData.email;
        // The AuthCredential type that was used.
        // const credential = GoogleAuthProvider.credentialFromError(error);
        // ...
      });
  }
  return (
    <>
      {!loading && !user && (
        <button onClick={LoginButtonHandler} disabled={busy}>
          {busy ? '處理中' : '登入'}
        </button>
      )}
      {/* <LoginButtonDisplay ... /> 這裡若要暫時註解，要用 JSX 註解格式 */}
    </>
  );
}

// function LoginButtonDisplay({user, loading, setIsLoginButton, LoginButtonHandler, isLoginButton}){
//     useEffect(()=>{
//     if(!loading&&!user || loading){//渲染完成並且沒有使用者資訊，又或是渲染還沒完成，登入按鈕都要出來
//         setIsLoginButton(true)
//     }else{ //如果渲染完成，且有使用者資料，登入按鈕要消失
//         setIsLoginButton(false)
//     }
//     }
//     ,[]
//     )
//     return(
//         <button onClick={LoginButtonHandler}>{isLoginButton?'登入':''}</button>
//     )

// }

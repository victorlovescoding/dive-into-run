import PostDetailClient from './PostDetailClient'
export default async function PostDetailPage({params}){
const {id} = await params
return (
    <div>
        <div>Hello 這是詳細頁面(id: {id})</div>
        <PostDetailClient postId={id}/>
    </div>

)
//去資料庫拿資料

}
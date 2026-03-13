import { Link } from 'react-router-dom';

const recommendedVideos = [
  {
    id: 101,
    title: 'Night Vibes: Best EDM Mix 2024 (Local Club Edition)',
    author: 'Club Mixes Official',
    views: '452k',
    time: '1 week ago',
    duration: '10:45',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJpDaPvYFiFf1_EhojvQtvr0wUNy53Cu24pTK2gnn90mPaf1RKkZubc31Y0NQn_imwNJKuE3UhUzyZjF7lSULmkf2TvbSccEUJvzjYiXIylxvmqquWsxr4kzy6IW57Dfr0nnqc3VH4tCP8WK_FzbmsjIpWgn2YCPSyJSiXDcQDNMB0UR8TV4kPBclq5gDGLcBAH3pNjgnLOQ-RYPuZ8t0j3t9qgmCTme_Q2WLBI8BavA8Xiq9wecaK3fEbUpGh4ec_BHco0gIV5F8'
  },
  {
    id: 102,
    title: 'Top 10 Moments of Summer Fest! You won\'t believe #3',
    author: 'Festival Junkies',
    views: '1.2M',
    time: '2 days ago',
    duration: '15:20',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEJ_Aevq18GaLfnopC_ejTkndmv0Xj9JU8RFoRBc7QjRi-N8W2X-LGWJQoqFSmlAELklrhZLmRCeln0XVwNruaCU9wkxSaaDNVcdqyXr0FYix4pju6LKs8as9ZAtGTTGyXlDXuTyOxIVgMpl1otMhyuCSk9g4z_esw7OBl3lz0nMwwgeQlJlbRjzVk1gcAF2hOQpHPPvDnlJ13orNr6_NWXPQJ-PSgkmQyuREnag7fgy2xUHEJ4OFcC4eTEfR334TgNTdoIB7qOC0'
  },
  {
    id: 103,
    title: 'Street Food Tour: Festival Edition 2024',
    author: 'Local Eats',
    views: '89k',
    time: '3 hours ago',
    duration: '08:12',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBn5bRJYVFwFQ6WsB3MLfbSRmpgjCGJiSqHI9r4I26MbJDQA4Vrz6yLhC_aSN7q23iYZaLDAz-Tg0hGMw8t2vftO-MkWPa4ayRBCb-NHBdgpv0jGG0EdOnF0Rg0ZUz76IVX1TJOXf9yRoDBFfvyLvj5aTGi06D7V3TmvE4WkeZaYJpKHGDvxkxaPLBziAjUnR2LE5WLor3W0iN2rEXlZLNk_9Av2ez44IZe7LSNGgNyja5aIeYGo3nsYfm4gxrCXbXa2S31JXXRyCs'
  },
  {
    id: 104,
    title: 'Drone Cinematography Masterclass: How I shot Summer Fest',
    author: 'SkyHigh Visuals',
    views: '23k',
    time: '1 day ago',
    duration: '12:30',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANV0Eq-uWTfBeQRQaayYvPa9TBEwoA4LsKOB30rRROnHeuefj8vdiLWeMJ4EHO2XOopCDkCkDcsiZ7KlEDT6Krwv5Yg8cZmPXnFUhtWYY153YEFHhFlUvqXMbrs86cz_jEz8cmIbB_Cn5r3ACV0a8byTYP_zsJOI5Pf_0KmJqa_U1opVA8YxUAbJECo9r03Y7y2LCcxphJXP8j7sd_135ISszydy6zSfDX73hCR5v2af8PYztcXnQ_fc4LTIxaRK68m8DaSwBvxqE'
  }
];

export default function VideoDetail() {
  return (
    <main className="flex-1 flex flex-col lg:flex-row gap-6 px-4 lg:px-20 py-6 max-w-[1600px] mx-auto w-full">
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative group rounded-xl overflow-hidden bg-black aspect-video shadow-2xl">
          <img 
            alt="Summer festival drone shot" 
            className="w-full h-full object-cover opacity-90" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBr5Dl_gxlWiMbkvPE9Sc7h6bV85xY_oZPAOJcScjTMl3pqnC46k57MqxNua3HQzYmOkYxBiYB7zO7ghm6u7Z5DMWxZWn7Z3Ueleq5WQ6ooiEyO3qKvXr_E_CCTYzNUnNI6IeEhgoQPuMG_U_eW48w07lFXou3hL8bxVe8UJ20aJMJFHHcVnsVgPI_e-ExM48J0-EwYxH1sWg4_gJ5l0l6pKkmFC3jMipFYAvziJe4b2-ROlA-xM3ABUTAFMBUAJ778Vfi7aFhlH4A"
          />
          <div className="absolute inset-0 pointer-events-none overflow-hidden py-4">
            <div className="absolute top-10 left-[110%] animate-[slide_10s_linear_infinite] whitespace-nowrap text-white font-bold drop-shadow-md bg-black/20 px-2 rounded">WOW!! The 4K quality is insane! 🎆</div>
            <div className="absolute top-24 left-[120%] animate-[slide_12s_linear_infinite] whitespace-nowrap text-primary font-bold drop-shadow-md">LOCAL SQUAD REPRESENT 🚀</div>
            <div className="absolute top-40 left-[105%] animate-[slide_15s_linear_infinite] whitespace-nowrap text-white font-bold drop-shadow-md">Wait for the drop at 1:45...</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-2">
              <div className="h-1.5 w-full bg-slate-600/50 rounded-full cursor-pointer relative overflow-hidden">
                <div className="absolute h-full w-1/3 bg-primary rounded-full"></div>
                <div className="absolute h-4 w-4 bg-white rounded-full top-1/2 -translate-y-1/2 left-[33%] shadow-lg border-2 border-primary"></div>
              </div>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <button className="material-symbols-outlined">play_arrow</button>
                  <button className="material-symbols-outlined">skip_next</button>
                  <span className="text-xs font-medium">0:37 / 4:23</span>
                  <div className="flex items-center gap-2 group/vol">
                    <button className="material-symbols-outlined text-xl">volume_up</button>
                    <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-white"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="text-xs font-bold border border-white/40 px-2 py-0.5 rounded hover:bg-white/20 transition-colors">1080P</button>
                  <button className="material-symbols-outlined">settings</button>
                  <button className="material-symbols-outlined">branding_watermark</button>
                  <button className="material-symbols-outlined">fullscreen</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">2024夏季音乐节精彩回顾 - 4K航拍全记录 (官方现场)</h1>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mb-4">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span> 124.8万次观看</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">calendar_today</span> 2024年10月12日</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">movie</span> #音乐节</span>
          </div>
          <div className="flex items-center justify-between py-4 border-y border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Link to="/author/SkyHigh Visuals" className="h-12 w-12 rounded-full bg-cover bg-center border-2 border-primary/20" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCz_fNRfToobYBwvLDqOHOJbjFwxKxu4p6x4ae-g-EKKjDmKVaiL26dOKlI54re32u-pGmfmrWfVF_Wxzb9YLO5HXgX8Wy0e0WX5_YYVS0QZYOjMExUXJo9PKfTpvwY-OI8Xz1LXsqSHfLBWGaD0ccduywbH77VeJmPfnqUzCnS7_skRPZguJnQFzlnnL5doMBKzN9J7LZ7nnmYxSxAY6t3ca8LxtqWCc9AKnRIlJkoFqfnODyeNyhYR2AKQ4jb4leeE_dQvv5fpRs")' }}></Link>
              <div>
                <Link to="/author/SkyHigh Visuals" className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">SkyHigh Visuals</Link>
                <p className="text-xs text-slate-500">2.5M followers</p>
              </div>
              <button className="ml-4 px-6 py-1.5 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary/90 transition-colors">Follow</button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"><span className="material-symbols-outlined text-xl">thumb_up</span> 45k</button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"><span className="material-symbols-outlined text-xl">share</span> 分享</button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"><span className="material-symbols-outlined text-xl">playlist_add</span> 收藏</button>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">回顾今年夏天最火爆的本地音乐节！全程采用高性能穿越机和电影级云台拍摄，呈现震撼的4K画质。特别鸣谢组委会提供的独家飞行许可。<br/><br/>曲目列表：<br/>1. Summer Breeze - 本地艺术家 (0:00)<br/>2. Neon Dreams - DJ Flow (2:15)</p>
            <button className="mt-2 text-primary text-sm font-bold hover:underline">展开更多</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">1,482 条评论</h3>
            <div className="flex gap-4 text-sm font-medium text-slate-500">
              <button className="text-primary border-b-2 border-primary">最热</button>
              <button className="hover:text-primary transition-colors">最新</button>
            </div>
          </div>
          <div className="flex gap-4 mb-8">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 overflow-hidden">
              <img alt="Current User" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7qiW7RucYKX7gXGMSC7lyJ7JEBhvhLzGm_MwAsBN7_CgnMjV2bPGIuhO-3qzZTRIXTPB6zs5mcowFh4wa-ylhrCh6odeTm7qwuOH1r6WfyTKs-AiG5Cp_FlOnBj-f9JH0uyf1q3ZOPHd7Ln0iIx8vJSfYg-Ae-_BQZUpP1siFCvw7fXzdoCJa0G2QtWXi7IeFCWBU2aB1HdOPsuOjhzLk0VPhs9i4JS1HWIR85ldR_bEFGb6hZB0iXhE6SA_ZBypbrIOO1sb_GOo" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <textarea className="w-full rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm focus:ring-primary focus:border-primary outline-none" placeholder="发一条友善的评论吧..." rows={2}></textarea>
              <div className="flex justify-end">
                <button className="px-6 py-2 bg-primary/20 text-primary font-bold rounded-lg hover:bg-primary hover:text-white transition-all">Post Comment</button>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDzc1eiPx_alEQNEp0tcudA9Kwaz8ECPlmqoG_YE7BhWG0rdqR_HcsMalt0W6l1n0iID9rVx2gHnPjRz7-2pAkddc3Bw4IDZ1hNSucdQaL9_5WAEyNSAZ6VeDqrS-4PeHpbpjgQZzSgUEj3BYiE1h2X9LdjZQeOanODhfcE_6Grj6PbPSvkUBCse3SKunGl8WJC3eEbL8uohC-ZbXPZjwcEjq68YSlgCTrLtn7-jW21_N0nKvBdZDMY_3JDSMSq3rbv_FIWjkYEK5o")' }}></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">视觉达人莎拉</span>
                  <span className="text-xs text-slate-400">2 hours ago</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">1:45那个航拍镜头简直绝了！请问那个镜头是用什么设备拍的？</p>
                <div className="flex items-center gap-4 mt-2 text-slate-400 text-xs">
                  <button className="flex items-center gap-1 hover:text-primary"><span className="material-symbols-outlined text-sm">thumb_up</span> 124</button>
                  <button className="flex items-center gap-1 hover:text-primary"><span className="material-symbols-outlined text-sm">thumb_down</span></button>
                  <button className="hover:text-primary font-bold">回复</button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBj1M0RxCvFSSmtUqBqvC6x4avMmix7NCtJREDt13Ryj9AoYxl2HBOV135am-oKdmoWwvxGHo3KbvFB9Es2TJYyngQpvXu1FkcysjZsAbWbnVV_4JEnQbvQmFBH9zwkq8jM9Z16RnhtO4VNf6H5I4FZ-kYkobaLjIhKTHFC3QWY_1g1FbdsvRzNO5cd28Dt9Mr2jbLlYZc_o4qnyfbDNn8YtkErPO1UMI7IJ-BOS6iDIDt7XOpRxRxPqGXpzgn8h3yxQ1_hOpaWceE")' }}></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">数码极客_99</span>
                  <span className="text-xs text-slate-400">5 hours ago</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">调色很有夏天的氛围，质感拉满。点赞！</p>
                <div className="flex items-center gap-4 mt-2 text-slate-400 text-xs">
                  <button className="flex items-center gap-1 hover:text-primary"><span className="material-symbols-outlined text-sm">thumb_up</span> 89</button>
                  <button className="flex items-center gap-1 hover:text-primary"><span className="material-symbols-outlined text-sm">thumb_down</span></button>
                  <button className="hover:text-primary font-bold">回复</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full lg:w-[400px] flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm flex flex-col h-[480px]">
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button className="flex-1 py-3 text-sm font-bold border-b-2 border-primary text-primary">弹幕列表</button>
            <button className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">播放列表</button>
            <button className="flex-1 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">AI总结</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 group">
              <span className="text-slate-400 w-12 shrink-0">00:37</span>
              <span className="flex-1 truncate px-2 text-slate-700 dark:text-slate-300">Epic drone work here! 🚁</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">10-14</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 group">
              <span className="text-slate-400 w-12 shrink-0">00:45</span>
              <span className="flex-1 truncate px-2 text-primary font-medium">BiliLocal exclusive? Let's go!</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">10-14</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 group">
              <span className="text-slate-400 w-12 shrink-0">01:12</span>
              <span className="flex-1 truncate px-2 text-slate-700 dark:text-slate-300">Loving the music choice</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">10-14</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 group">
              <span className="text-slate-400 w-12 shrink-0">01:45</span>
              <span className="flex-1 truncate px-2 text-slate-700 dark:text-slate-300">Wait for it... wait for it...</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">10-14</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 group bg-primary/5">
              <span className="text-primary w-12 shrink-0">02:23</span>
              <span className="flex-1 truncate px-2 text-slate-900 dark:text-slate-100">STUNNING VISUALS!</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">10-14</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 rounded px-2 group opacity-60">
              <span className="text-slate-400 w-12 shrink-0">02:45</span>
              <span className="flex-1 truncate px-2">Amazing production quality</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100">10-14</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-1.5">
              <input className="flex-1 text-xs border-none bg-transparent focus:ring-0 p-0 outline-none" placeholder="发一条友善的弹幕吧..." type="text" />
              <button className="material-symbols-outlined text-slate-400 text-lg">mood</button>
              <button className="material-symbols-outlined text-slate-400 text-lg">send</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span> 为您推荐
          </h3>
          <div className="space-y-4">
            {recommendedVideos.map(video => (
              <Link to={`/video/${video.id}`} key={video.id} className="flex gap-3 group cursor-pointer">
                <div className="relative w-40 h-24 shrink-0 rounded-lg overflow-hidden">
                  <img alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" src={video.thumbnail} />
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">{video.duration}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-primary transition-colors">{video.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{video.author}</p>
                  <p className="text-[10px] text-slate-400">{video.views} views • {video.time}</p>
                </div>
              </Link>
            ))}
          </div>
          <button className="w-full py-3 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">加载更多推荐</button>
        </div>
      </aside>
    </main>
  );
}

import { Link, useParams } from 'react-router-dom';

const videos = [
  {
    id: 11,
    title: '东京后街的隐秘之美：电影感之旅',
    duration: '12:45',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbbh3ss_RD1s4yuqb20ma_C13Zf14QseFpB1zUro5Ik0bo3rUeJYRAwrO4GSRB6FgWn2P7kKrTUWyAy5sWy9Y9b3omGD8eAJwQSz3i4Bq7a0CU0QeIEY8NyirzHj31Bm58hXEddR8u05crMBVWHTfFhF9MWfzEhjR4bs6cqMDDYbLBMCBDOpvs2ioRK7KxQSWiwqBz2ANzhcWPxI38zaPgSMTIg7nUjeeHEQGPXKhQaIRu2oTYX5oyK4xwpyz05d6ogpt0-QUeydw',
    views: '2.4M',
    time: '2天前'
  },
  {
    id: 12,
    title: '如何为我的电影感 Vlog 调色（分步教学）',
    duration: '08:12',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCt55AfuY7FqFN8jcrHLtNbFX8cGnoxfmjT2nex88OKR7AztzRE0twTyNaqrReXOEHkWH1pv7xd4A7kEhSZ-a0I3nunp39-zOoEVZcPIwwNc9yAnjJRxP8XwfH5cSug8YdAkl59BWQZ6vrI9SB0cpleqRc1R4ZXqrpFKauS0sBnewfGvdUOBvfNZRmK35pdkxewSTMznynGXCGthRPUWXSHiExVS2IH84n4yjFepOyoEyHu_mu5JuzpMzdXoTwNzuz0JlmBlaaODnU',
    views: '890K',
    time: '1周前'
  },
  {
    id: 13,
    title: '霓虹之夜：探索现实生活中的赛博朋克美学',
    duration: '05:30',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCu-YM8A5oGVsx01Uoma0k6HwuF19EKp_vkk1ifnnu9gjf1SLRFf61RTm_DJlW1Ego5Ef9BJEtGzdn6ZeW712WyH91QLFfsIpykBl6HF6C_0A1RnX8v6wzHNu947Rv5fKSO8lYKhDYQSg8-_hzCDCndpzYVfjVqr41l340iAmQH2Rn2s1VJCxVnWXOqOvyZL6JJ8EsbuGI9gcsPYppv64cX8ACdI4YLEb9c2XZkVRkfWMZqCp0MPYxuhJ5JlY5xKq2mLJUOutJ4bE4',
    views: '1.1M',
    time: 'Oct 12, 2023'
  },
  {
    id: 14,
    title: '意大利之夏：在繁华都市寻找宁静之地',
    duration: '15:00',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzUUl4db6-OhnvLFOuR7rpkfea5DenEWhAbuhNJMVKQGX_4Xof4Je9eiVasWL1FXq28BTBxS9eZLro0cPAUronynTrU-zWT_3ab_5CC9wtsg73u7B29qsWH4MX7DfPLrY0_IEfw47TTBXgkYSji2p25E8kzkUmQdsEHkhsf-oped6FsNk-LwO33xFy_8QXuB3-QsoesPR7mR93fWNE7PWczLwIoAwhBWByHs_h4CZVZz9NIfk3EmSO95jv-VrIYrkQ8sXJgZLLT8M',
    views: '650K',
    time: 'Sep 28, 2023'
  },
  {
    id: 15,
    title: 'FPV 穿越机探险：攀登北阿尔卑斯山脉',
    duration: '06:22',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCsN7IfSPurbXDaj0gBsBALt6zUNRYHCrz9MOsZIIbezEbNlOI7bjfkD-jhdq26O8CyVrXeZdDY6kD9e7zHOmwTFOdWmC4yKSakXpby4RdaWFlUJTq69mS5Rd8QkUW4qK9IBchDlp9BgvduMBX9FifpPxEP4me3W0AbA-hzkVA7OlJPp3Ts1bgljvHTfvgsNk1DK0Zj-Df6Bi0rfL1tnVrbgVWRCCkFFnGD6sN84FXwMgBjS5ghcm3knqN7KAS2EDdi0Ebhuw4cWWE',
    views: '2.8M',
    time: 'Aug 15, 2023'
  },
  {
    id: 16,
    title: '2024 桌面搭建：专业视频编辑必备器材',
    duration: '10:45',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWya6EcXb7oIScJ_8054TYOyL7Zhl4KQtA1BGkOPbdAHh6PIG7HKwUIPhWgbJQpmvPTCAqG_oBnj-G49ir4W_kJwZ8I5IuAOW_1Q_y0ugoUaT8WnU06GqP9jaWAIJmO7mdZX61fvi5j5nZGz0RVTEbbxcFhXWo3en7K4pThA0V-cbaqMvrkPl91KkBlEgQr7h4vlfvinM80Ms5bjmjV_t7B7d6TU8BruAvfcuoF6IMRfg4_ScckLCIV6dt-U3pQUxCSLI3SOuDQrU',
    views: '420K',
    time: 'Jul 02, 2023'
  },
  {
    id: 17,
    title: '定焦 vs 变焦：为什么我换到了定焦镜头',
    duration: '04:55',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDydsSXqrDVKEbFAZz5s1XFdF3DIVvoz-BQ_V0lioRTpVfE_S8Je8Y2oSLJOlYO8OVWxUJXEjvnV6msYc60Vhop1A4nf-MBokZ6-WENc_RrgL618soyMM-Jg4ToFiVzYyokd01h6sgD0iU-EDiylUX1arYn-mug38A-rOwEVDFaik80zUcFVaGAIyqOJ3JdiGADkz4A1duidpNn6-ZHeydZuAK9lotSLe2o50Q0LNw2KF9yx8iWbMzjhUH7jm54VHEBh9LzHMZtaew',
    views: '310K',
    time: 'Jun 20, 2023'
  },
  {
    id: 18,
    title: '低保真记忆：复古电影感短片集',
    duration: '22:10',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnyTh-Ne9kfY5OeBEh4-AL5zRpDGyXZuVvkQCYiXq9JjW3gRykB2R2FxVL53bSN7uU2czAtp6pMpwNWr75MeuZCyVggsxNfPuKJIDJslaAzpIInRDSJeSF-NSLBJIlgFBttQyBux1c9bnD6wzqvCuGFbGoW7P_hmNsB5Wr95NjxLs35FBdeLqrteWA-J7O68ryicpBXhvQlKxqPbqfaa037DiVbHogn1QjB6kv8kREXyCuPpAMCqjBPoJHnxKPG-oYfYrXkC4hlfU',
    views: '1.5M',
    time: 'May 14, 2023'
  }
];

export default function Profile() {
  const { username } = useParams();
  const displayUsername = username || 'VibeDesigner_Studio';

  return (
    <main className="flex-1 max-w-[1280px] mx-auto w-full px-0 lg:px-4">
      <div className="relative w-full h-48 md:h-64 mt-0 lg:mt-4 overflow-hidden lg:rounded-xl group">
        <div 
          className="w-full h-full bg-center bg-no-repeat bg-cover transition-transform duration-500 group-hover:scale-105" 
          style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDop3MTWCOFiG1GUmkftS9rKoS1AG1a4M8ILCBuB2usOYajLYuJ1BZ1ntmIDH49eO1-H0Xvt1_tom-XJchNo1vzStaT3MSq1hIW7hU0dl3TcKSrjkr4_vjkEZhhYnPf06xhFhG3IztQ3aGtdiOaWiw4sOqDTUDHfXWBfmibk4hPaSzfi2YP-ERKurcGdIAexoW6eUZkeTVA4H-DZe0bgbsr64tiUnJt0hHZf9yD_gPaiSsAx7r2DiRmHu0OzWUUWUsn2T51wzvJ0h0")' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 lg:rounded-b-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12 md:-mt-16 relative z-10">
          <div className="bg-white dark:bg-slate-900 p-1 rounded-full shrink-0">
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-24 md:size-32 border-4 border-white dark:border-slate-900" 
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAmfjWLbAqH7jp5A9KQA2sQQAPUWBfYpT8bbicGuunV-1IwiqZ3JbhnoZN6_3CEImP5yL623Py5o0uUX4NyhAdAdgl4ugxi5sKPCrCcnH-2MCo4QpfKySuTk4BEuZC6JqBCuFHXCdM19CODkJdRJEgQnSgU3JbJJl-W9HZZTaw8ASeN7sXEsSP8cWo9aDA94BZm0kHGonvUDanb9O77UqLz19aFUL9L4jvTZP-JVtlNm4CGdmIIVXb-6BQcNvubFEwXNhG52r9DHVs")' }}
            ></div>
          </div>
          <div className="flex-1 pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{displayUsername}</h1>
                  <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">LV 6</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  Digital nomad, cinematographer, and motion design enthusiast. Capturing the beauty of local life through a cinematic lens. ✨
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-slate-900 dark:text-slate-100 font-medium">1.2M <span className="text-slate-500 font-normal">粉丝</span></span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">89 <span className="text-slate-500 font-normal">关注</span></span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">4.5M <span className="text-slate-500 font-normal">获赞</span></span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-8 rounded-lg transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">add</span> 关注
                </button>
                <button className="bg-primary/10 hover:bg-primary/20 text-primary font-bold py-2 px-4 rounded-lg transition-colors">发消息</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[64px] bg-white dark:bg-slate-900 z-40 border-b border-primary/10 mt-4 px-4">
        <div className="flex gap-8 overflow-x-auto no-scrollbar">
          <a href="#" className="flex flex-col items-center py-4 border-b-2 border-transparent text-slate-500 font-medium hover:text-primary transition-colors">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xl">home</span> 主页</span>
          </a>
          <a href="#" className="flex flex-col items-center py-4 border-b-2 border-transparent text-slate-500 font-medium hover:text-primary transition-colors">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xl">rebase_edit</span> 动态</span>
          </a>
          <a href="#" className="flex flex-col items-center py-4 border-b-2 border-primary text-primary font-bold">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xl">play_circle</span> 视频</span>
          </a>
          <a href="#" className="flex flex-col items-center py-4 border-b-2 border-transparent text-slate-500 font-medium hover:text-primary transition-colors">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xl">folder_special</span> 合集</span>
          </a>
        </div>
      </div>

      <div className="py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">全部视频</h3>
            <span className="text-sm text-slate-500">124 works</span>
          </div>
          <div className="flex bg-primary/5 rounded-lg p-1">
            <button className="px-3 py-1 text-xs font-bold bg-white dark:bg-slate-800 rounded shadow-sm text-primary">Latest</button>
            <button className="px-3 py-1 text-xs font-medium text-slate-500">Most Viewed</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map(video => (
            <Link to={`/video/${video.id}`} key={video.id} className="group flex flex-col gap-3 cursor-pointer">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-200">
                <div 
                  className="w-full h-full bg-center bg-no-repeat bg-cover group-hover:scale-110 transition-transform duration-300" 
                  style={{ backgroundImage: `url(${video.thumbnail})` }}
                ></div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                  {video.duration}
                </div>
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-5xl">play_arrow</span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">{video.title}</h4>
                <div className="flex items-center gap-2 mt-2 text-slate-500 text-xs">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">play_circle</span> {video.views}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">schedule</span> {video.time}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 flex justify-center items-center gap-2">
          <button className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50"><span className="material-symbols-outlined text-sm">add</span> 关注</button>
          <button className="w-10 h-10 rounded-lg bg-primary text-white font-bold">1</button>
          <button className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 text-slate-500 font-medium hover:bg-primary/5">2</button>
          <button className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 text-slate-500 font-medium hover:bg-primary/5">3</button>
          <span className="text-slate-400">...</span>
          <button className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 text-slate-500 font-medium hover:bg-primary/5">16</button>
          <button className="p-2 rounded-lg bg-primary/10 text-primary"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
        </div>
      </div>
    </main>
  );
}

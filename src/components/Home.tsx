import { Link, useNavigate } from 'react-router-dom';

const categories = ['全部', '动画', '电影', '游戏', '音乐', '科技', '纪录片', '美食', '生活', 'Vlog'];

const videos = [
  {
    id: 1,
    title: '2024夏季动画精彩回顾与推荐',
    duration: '24:00',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVoVR208XyTKyH-CSrACS1pMWCU4te60o3JhyBvnnpwdTqIxJ4MkgofZi5xdyM1TpY9tBBPGUrKZkbjdCp5Yo_TaDf1eQ55pLslFe1WVLvTtjqhNAQIo19SGFwm9hxiUsujggB71oLkkmw1jjQGbIgH_DykY4h82vsl7Wz86_4zCIjSLGkLl4efBhUGNhzo9CjA1TQOtO6m6wpVp7kTau2LjgyfJQlff7J-elR7DBU_dXi7wCyS4bn7vPIISdbLIsqR9MD4nUyosk',
    author: 'AnimeExpert',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzbVuWrq_Us40Uc6qU0TWNQShTp5qQj7FLLiynhO00U90e1Yay7hepN6XMoaWXzLOyI4QFol7BDQPqdkkzlYeMQr569gEKdmOva0mIebKA5Gs28dNmrpGNV8PoLnNVhaf-4nb3oyRQUh8itXdbGDExivAAnK6QEY9qcWSCUbYLLKAF6fwPJNcMWvOQIYK0ybTE2ThuOpjtYIk388JzGU-LtS4baGcYcdILwujKBh_cJ1oRfR7Gv0LIsaBKhjzmezi5ciYTmmAe85A',
    views: '120万',
    time: '2小时前',
    verified: true
  },
  {
    id: 2,
    title: '近十年必看的10部科幻电影',
    duration: '02:15:30',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFsnG0tttsuWyqwq9XtsRmq1lJu7Mr7dohUgxQRcZuycMLhuvoINaulFBAzqHK94SJsWLT7qFWh5FhvxJ89RVS9880qkwn68qM7WjPsJoZUPuEC9i9XnVPRCv9bXmM1YYc-BVHcWDNInorAsjVIVPhdoBcXTxAcwyrFuOEEj-ap5SyGxm83WdDmObUg5b0wYxIGSMjCR_7FnGXpNJsf9IX2unDIjH8LugE1JpKtf7kAtt5sqTAoTL3949K7znNxOOXtbFa7Snfz9c',
    author: 'CinemaLover',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1dNzdq8Il6kgtbS1aLnPFBFo0HMYOPk_l_tg9rJ4z9yk_5M0aZGIwXmwdRBN2Ldjfga7EwXe5ZXGbrEPapqXuFY4WaYMEYZz88EKwcGBOCUnCpTk4ohm7qoYrU-b4N9St49PvR6JvkQTChmIOAyJWqgdO9MjWlDI_0wCifoj6At_6zaIg7Qtv9Xeyo5XLW5vMbo74Ahy5jH51gCDiNghAVaqqFPzkParb8lT10CM29-Jc6BYlih4aHO_PIJbnUgdlwjjcFe_nz20',
    views: '85万',
    time: '1天前',
    verified: false
  },
  {
    id: 3,
    title: '打造极致 RTX 4090 游戏主机',
    duration: '15:45',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDEqImITbuR5fDQuu_NcSgcYIEqR1p9asNmODQRIUv8mUfePHpBr1l1MuR_7lJhvOGMU2FKnZ7gmmhYlG_WbiLGUqLOWKAgbIoDR3_RdxvFRCGraNZhRti61kuRLedDrpmCqTx6q7HVyROIZrtIi9G7QFdwJ_RvXzBfxgaILzmx60K49jrSUfPzu4dQu624D0AWocN4DM7-4i3RDGNyo667Oe-CefGP6q_eeXHbiCpIAwe7TicV05eIAnPe35P79Els6vqzAbjUVf4',
    author: 'TechWiz',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClIqjfnnQmopxn5RefjSFWUPKK76Y7jkNKIrTxz8zxA6ga1Ukl0VbwmeIwtyqzk8ck3_0huBMj_J38Or6715bV4ElCi9pSb-ZpXMpR0g3NzOspPveY0vvUp2-FDtksTBEpps5Jq2mFXu_gFszTUUIV81Rk9phA6JPijwcn4KV0SJF73jwdThjUp8M_O-fssQDaj66752Q4DvOq6EYyda2ioM-7Qrw5-z26dt7MaJqzS5UnDTM7fLN5bzKhllroblz0YhI-WfWsoOs',
    views: '43万',
    time: '3小时前',
    verified: false
  },
  {
    id: 4,
    title: '学习与编程伴侣：Lo-fi 音乐 (2024版)',
    duration: '04:12',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBo3jQDzJHmi2xAMZAHoouDFd9Ix67PaM4-RkErSZcXo-jcs2PULa6abKd89ibq3dopOjh_BTOSzf0OpZ-hOF1QiaVYgdKoYR4mpM9iyLmPfnIjZ647xDVTU6dQKkqW7gYlRi_-jofwzJBxsFCvFpCXWIQVeqNedvSQJ6-XnNHgibvAPC4JumIaXp25T-eMoKQqwkPRwVx3r9AnlNuG1H_ads6oWsegQ2yxoBymAMOadwgo8EX_3R1Xy1b3mtr2-onK___ZLdfjGHY',
    author: 'VibeStation',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCnFU2YXQd6hQUR0saww3CToAnxONxKKhEDx_EgWCh_Mndoia10UF8bTzZOaFYXMR3Xq8lKfrUJh1iaVbpHzB08mTBMYe_AC2PTueWh-4kA0ytgbv93cMdRsZ1TTLXZ0VvXgsxruiGGnH8XHyrxha4jVMzZOsCXz2fG6vIvrwRHU2bEaioZFpDGHXqhiV6kMOsycXviXYcO1fNSDEXPJwaN26eCr0qCnvgzWlZEKgxzgrihn9f-I0g539fR320M1GHOf8b4lYDDjDA',
    views: '250万',
    time: '5小时前',
    verified: false
  },
  {
    id: 5,
    title: '如何在家制作正宗的日式豚骨拉面',
    duration: '12:20',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAc9pbrdPVWeWieQlRsdq0MjmBKWVQgxiP6BLeVQmLQ5SMh4-UNKt97ha9Y18GZCgn--Cwkd_qQZUXk6IuWHeQrWnmLHQesBAkyRHhDNn7XlkU7t_EzOdvtdWE7-ePUUqFLIc7qz4KOPTQlGycH8R-V8j00joPNv5f6VDNZjlB97LCMDmX70mjFRrtpFwiIVuD5vhWBpoLwbV8XtMPMTos2qF3fd3LtZtXEwLc9CzTJI70-Tt6UgqCcCNg4TAz8ncx_jiV71vqKKBI',
    author: 'ChefDaily',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDyDZiQBGkggOqoVwSf0Nu76uyTp1iR5w4O0ROlko4BIvwjclpeiz8o4ZrKvnNIvcIpso-tBVfjXZhQ8qABZufoxtKXtaLcs3I6yrW4t7VqLfWYxacp3C19KSiwudPhuGewRCTl58374Qa6KcAEhMFggWho7F0KjmWyAsMUMlxBrsD_EiKqa9Myhkls6CyXeRz61tPaCxcQlsS49ff9FPgE3r13ZUcGXZvXMPQju-Hbsax_Z0WgQW7072dfoEV_EBOwcuoLlzSyPo',
    views: '30万',
    time: '4小时前',
    verified: false
  },
  {
    id: 6,
    title: '摄影初学者创意拍摄技巧',
    duration: '08:50',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDu_QOyLLP8MWstoQhuOWlHDM_bcabo3_ABYjBW8YgrujEUMeNS6TluXlq93C_Dax1BmDX5Xh2BH-_6dVv7Usr-aQ-hxvKY5YvcWVN8q-F2VSqzWvRXLN1j4eFnsAhsJoKJ7emkuduRJxP7Kk0N4odJVuTW98xfVtFj5W6lmThArMWGLMa1nL6EkE4HTB9zlrw87g9ofPJEtHgFP8eDqHFxEOuOKFS2oeWsUo6h--Yl06evksYvfVxHMCMJton0KuvHR2dvvgdnLLo',
    author: 'ShutterSpeed',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKkXUhYVZAG66HtzecAABo2ZQMKKBDtDFnoHXm1oQWMnSnXnUXSeTILk2fHcrv0QCUNJGMoLTsf9Hpj5QQ89LZnSbDjVyolI-ffpDTssAF3gPgckMV_8jQm-HNVP66cQjTAj4xC5Xcr13r1baGyMLhp75CoKwyOeUs9ZcTtOgJk6LnIlsXq4_mlx45LBKeZ90zcqZ9aqretL80QjE0QemPrIE0LvB49T5cC2MnQCJs8I9KNJRG7wRr5bdISf-oSwreg7oxhU0ADRE',
    views: '12万',
    time: '12小时前',
    verified: false
  },
  {
    id: 7,
    title: '挑战专业运动员的30天训练计划',
    duration: '22:10',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfjOhmMT5ru6CUAqvmmEc9o9sWp687-HZ4XUVqjj5_YpOb6xSaJYBZXnPgZY5jHYCITS77W-evg4I9V4_uRlcCE5Q1NN2gr5nV-lYXnCJMegIvkB5xDqv3f1_yBO1zyWU8OAquF0riE9YMku8dlNyTsz89E4zlPh3HAXx-y2WmxqcpvRW1yc59Ytg6NkubZcpDhrxZpsaLa3HHMbT21GuSPEyhvmmvVs7KDcCs3O852uwK1Pk8NG__qACG1W9ywgL9JqPWF20ktcc',
    author: 'FitLife',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCt2ira0Kb65uv9dS0o_g413H0M41gijGU_PddzIrY7daxAwyB8Oo2HVP23c0vYce8_TImqboBzrgCR4y5ikb2z7lQL2t0GeagcCJfc39y37LMH7DYQS92wNeGAGJzZHbpeGLvGBAbcKcxOwBgyeUAapMRDvhxRxYae7FGAFla9-0eGzRPvOxYLc6WDC6tnHRJAoWWApwfATrGrxqAcdegh-a_EENlBJIlMu1Bn-BaDZXpDn0yVcM8ZJYqBXU0ovJ_CGwBzkm4-jnA',
    views: '50万',
    time: '8小时前',
    verified: false
  },
  {
    id: 8,
    title: '高级 Tailwind CSS 技巧与自定义指南',
    duration: '45:10',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6tjy_tz72etPkNB_Tp3xy6xjaTCcc_fAUsSTLXFigYo2kimkyKSRDJ0BFak7mEcQ6yKg-OrfrjwCl1JQk8PIyqBxY_Yl7-eNB-MgbgU8vqwkLhh30dhWbHIZIIyqxokDJJqAonbrwM23ELx1rssVBY9zftNb65sm64NuTeUcCth2VLaYfRk4sLk-ExQJcnETaBl7LY5yhpuTPG5oHVTQjFzv2_tMIMObEhDT6nr1k85wJC0lhQQiNP1LlRXvNVnBdyaHh0aGtd0w',
    author: 'CodeMaster',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBk_WDdeXjgOAYY3xIdPXN3uaWtsZoAcc0Z47ZGUY7UXRGV7bdR-LkuNdhlwkQHPwRHLT3k-qm9lUGZAkInbtCrhtZKj1cTnjNAhxDkARzE9u3Bs54mltjvpnff3FL1kXzHUMITLx-5mhFpevKL25kAqY9pH9MaeGZ3MM25QdxwLjAYCe3uarEwlHiR3DHOaa2D8QhmG5eXMBsYsvRpqyGpM9K2o3tQrcU94TYcPKZc9UQjMIqiP-51VuWqR9Cd33Ica8DJ05-yFwQ',
    views: '7.5万',
    time: '6小时前',
    verified: false
  },
  {
    id: 9,
    title: '4K 电影感自然景观：壮丽山川',
    duration: '05:40',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLIvIiM5tZFO-46a8nJ2aU2ybS1x53Ss3qs8-vyHVsWJDjWG4taK7dX2udj9pK3lXEwWeIyu8N_sLAntw2mrZNbnv9rZBDGNM6Ft1G99oCh9b4C8z0EHcx7WUmnYMhUMos7UXisU14xJhQPgMkGbeVShOeDfNsqnl-A4R1qme8ecP-_Z34HJXKFemORIDFpMyKf6RpLlmsqRuwLI-QxTatxLrtZqJgc1oAL_4nq-vQtBiI3vFhnC8uBk3tXUAJbTFYRsIh1HgKfII',
    author: 'EarthExplored',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDn0Bi-uCpYsM97iBqdBRzM0r4jJAjFAFpmh4my6ioE99WWb4jpk_QUqDDS7JSPxbn_VdG2RbOgjr15dOzk13ie4h3vEoCV9KtWcpcCtl3zMhL43Qhreg5FyArNiQ-h-9Cx9y_GM2aRhvi30_4QWXNqHYXz4CANSYEpx81QMMv2R682HWyF_c9vM8WIXOdyPcRqrobWUCgYC2TlTky3K6IwLEedDiVbqC7ci44RTgJeq6U9maAfW-7skHFn_ATYHL0M5VGsa2CMyY8',
    views: '180万',
    time: '2天前',
    verified: false
  },
  {
    id: 10,
    title: '2024年如何投资你的第一个1000美元',
    duration: '18:30',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5YdvXUNQ5i6nOCArutxDTe2gn2yLNCSDJcDyL5ZFHW4QSN-NC1mk5LcTuUmfnhFNjD5uhW3XO75IlrubqqnIwFy48MhBwJM2vlrXQbyEQiASy5yVXrKNkL6zuw8o7EcYYmE6IKtIWugJsjMzIVXKM-HyMSPexOybxxKEapYrJ7jvS15xJBoQ_ihslr0B3Fxh7eGNeSCTPLFyxZjmzzmMkICg5xHXs9ZgKQRcxQYyNoVpCHMw3oQoXnqVBSwW93B1-_iZM9-VW_V0',
    author: 'MoneyMindset',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWsDr5xggyZDih0ggZrsga0eqFMi0sf78YVivJA8JxM1WijgsCtL4JLDhUuSPzQQvB32FeW1w51ke-Lig0O13vbIqLFfUSm6P-3HanKTDyWwK-Lr4npO3inAoCNhXRLtPw7UXFNJ8xHvgW-qfuq8x30q1dJNi_MUkn7zUsjSe1YWzlfRgTvX5k1qX0Z5L2IHrBh9SPCeljUn7IYlKdM_MDHZcCAlD_T_9pkXY27j7WgxELXYSKdbQvl9duHCBKffI8BEjGNalhlqM',
    views: '21万',
    time: '5小时前',
    verified: false
  }
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 p-4 overflow-x-auto no-scrollbar scroll-smooth">
        {categories.map((cat, index) => (
          <div 
            key={index} 
            className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 cursor-pointer transition-colors ${
              index === 0 
                ? 'bg-primary text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <span className="text-sm font-medium">{cat}</span>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 p-4">
        {videos.map(video => (
          <div onClick={() => navigate(`/video/${video.id}`)} key={video.id} className="group flex flex-col gap-3 cursor-pointer">
            <div className="relative overflow-hidden rounded-xl aspect-video bg-slate-200 dark:bg-slate-700">
              <div 
                className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105" 
                style={{ backgroundImage: `url(${video.thumbnail})` }}
              ></div>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
                {video.duration}
              </div>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            </div>
            <div className="flex gap-3">
              <Link onClick={(e) => e.stopPropagation()} to={`/author/${video.author}`} className="w-9 h-9 shrink-0 rounded-full bg-cover bg-center mt-1" style={{ backgroundImage: `url(${video.authorAvatar})` }}></Link>
              <div className="flex flex-col min-w-0">
                <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <Link onClick={(e) => e.stopPropagation()} to={`/author/${video.author}`} className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 flex items-center gap-1 hover:text-primary transition-colors">
                  <span>{video.author}</span>
                  {video.verified && <span className="material-symbols-outlined text-[12px] text-primary">verified</span>}
                </Link>
                <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2">
                  <span>{video.views}次观看</span>
                  <span>•</span>
                  <span>{video.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

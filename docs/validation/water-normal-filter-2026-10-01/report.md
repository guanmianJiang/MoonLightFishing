# 水面法线坡度与远景重复衰减修正

## 确认的问题与修改

旧法线纹理已经常规mipmap/各向异性采样，却又乘(1-smoothstep(0.07,0.32,最大世界像素足迹))、(1-smoothstep(35,110,距离))和0.5–1掠射角倍率。足迹0.32m或距离110m时整层坡度被删除，不能区分UV密度或长短轴分辨率；图中近景细水纹与远景宽云带的明显分区与此一致。未采集截图确切深度/相位，不声称它是所有宽条的唯一原因。

删除该额外法线fade；两层各用自身UV的真实dFdx/dFdy进行textureGrad采样，保留纹理mipmap及最多8×各向异性。岸边shoreFade仍独立保留，原世界足迹颜色调制改名bodyDetailFade，只参与水体颜色，不改变法线。距离变量继续供高度大气积分使用，未删除大气路径。

按当前自定义UV(world X/Z为正方向)，编码法线为(-dh/du,-dh/dv,1)归一化。旧detailSlope使用正n.xy/n.z，再构造normal=(-slope.x,1,-slope.y)，把贴图倾斜方向反了。现在waterNormalSlope返回负分量/上分量；第二层的UV旋转与转回不变，分母安全下限0.38保持。宏观波、交互、反射复用normal和曲面独立混合均不变。

没有改玩家波浪强度、贴图强度/尺度/速度、反射参数、天空或调色。反射仍是全景天空+主相机捕获SSR，没有平面反射镜像相机。正常纹理采样仍两次，无新增查询、纹理、draw call、目标或人为模糊；移除坡度的二次衰减不代表实现未解析坡度方差BRDF。

## 离线资源反例

tools/analyze-water-normal-filter.py只读取真实1024×1024 Tex_Water_Normal_07.png像素。周期9×97 texel窗口平均近似一个有长短轴的UV足迹，不是GPU各向异性采样的精确实现。以UV密度0.276举例，长轴覆盖约0.3432m，旧额外fade强制为0；该窗口下贴图坡度RMS仍约0.06979（原图0.11422），较窄方向确实还有变化。结果见normal-filter-metrics.json。此为资源反例，不能当作用户截图重建或实画验收。

## 验证与限制

- 新增5项测试直接执行共享GLSL标量及实际水面normal表达式，用真实Three向量验证中性/各向倾斜还原、旧正号反转复现、零强度/分母夹值有界；检查两层各自UV导数查询、旋转/岸边接线与反射使用同一normal。
- 更新water-wave-strength中的旧固定fade用例为新过滤合同，同时检查大气距离变量声明保持。
- 相关46项通过；当前全量601项通过，0失败，见tests.log。
- 100模块构建及资源校验通过，见build.log。构建未编译GPU shader，不代表GPU编译通过。
- 修改文件的CRLF兼容diff空白检查通过；spec/实现/测试一致，旧fade章节标注被替代。用户禁止电脑界面操作，本轮未使用界面工具。

截图基础反射增量0.32经F0=.0204+.9796*base得到约33.39%，反射强度0.9后正视权重约30.05%；远高于增量0的约2%基础，会放大倒影可见度。它改变权重，不改变反射方向，不能替代法线修复。玩家设定保持。

待验：GPU编译、9:16固定波相位/相机前后，波强度0/0.35/1、法线贴图强度0/原值、太阳方位变化、海天线/近远过渡、云倒影、SSR边缘；320×568及横屏兼容。低端真机默认与关闭SSR各环绕/垂钓60秒记录GPU帧时间、内存、闪烁及各向异性支持降级。远景更多细法线保留可能改变Fresnel/SSR参与片元比例，不能仅凭相同查询数承诺帧率不变。

理论参考：[PBRT反射纹理采样与抗锯齿](https://www.pbr-book.org/4ed/Textures_and_Materials/Texture_Sampling_and_Antialiasing)、[NVIDIA法线与高度坡度关系](https://forums.developer.nvidia.com/t/algorithm-behind-converting-a-diffuse-texture-to-a-normal-texture/203220/2)。

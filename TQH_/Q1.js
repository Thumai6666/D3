// chart1.js
// CSV cần có: "Mã nhóm hàng","Tên nhóm hàng","Mã mặt hàng","Tên mặt hàng","SL","Thành tiền"

function parseNumber(v){
  if (!v) return 0;
  const s = String(v).replace(/[^\d\.\-]/g,'');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function getTextWidth(text, font='12px Arial'){
  if (!getTextWidth.canvas) getTextWidth.canvas = document.createElement('canvas');
  const ctx = getTextWidth.canvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}
function escapeHtml(s){
  return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

d3.csv("data_ggsheet.csv").then(raw => {
  // Gom dữ liệu
  const rolled = d3.rollup(
    raw,
    rows => ({
      revenue: d3.sum(rows, r => parseNumber(r["Thành tiền"])),
      qty: d3.sum(rows, r => parseNumber(r["SL"])),
      groupCode: rows[0]["Mã nhóm hàng"] || '',
      groupName: rows[0]["Tên nhóm hàng"] || ''
    }),
    r => (r["Mã mặt hàng"]||'').trim() + "|||" + (r["Tên mặt hàng"]||'').trim()
  );

  let data = Array.from(rolled, ([key,val]) => {
    const [maMat, tenMat] = key.split("|||");
    return {
      maMat, tenMat,
      groupDisplay: `[${val.groupCode}] ${val.groupName}`,
      revenueMil: (val.revenue || 0) / 1e6, // chuyển sang triệu
      qty: val.qty || 0
    };
  }).filter(d => d.revenueMil > 0);

  data.sort((a,b) => d3.descending(a.revenueMil,b.revenueMil));

  // Layout
  const margin = { top: 30, right: 40, bottom: 60, left: 360 };
  const barHeight = 32;
  const innerHeight = data.length * (barHeight + 6);
  const innerWidth = 1100;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  const svg = d3.select("#chart1").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data,d=>d.revenueMil)*1.1])
    .range([0, innerWidth])
    .nice();

  const y = d3.scaleBand()
    .domain(data.map(d => `[${d.maMat}] ${d.tenMat}`))
    .range([0, innerHeight])
    .padding(0.2);

  // -------- Gridlines (đậm hơn) + ticks text --------
  g.append("g")
    .selectAll("line")
    .data(x.ticks(6))
    .enter()
    .append("line")
    .attr("x1", d=>x(d))
    .attr("x2", d=>x(d))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#888")         // đậm hơn
    .attr("stroke-width", 1)
    .attr("stroke-dasharray","3,3")
    .attr("opacity", 0.3);

  g.append("g")
    .selectAll("text")
    .data(x.ticks(6))
    .enter()
    .append("text")
    .attr("x", d=>x(d))
    .attr("y", innerHeight+20)
    .attr("text-anchor","middle")
    .style("font-size","12px")
    .text(d => d3.format(",.0f")(d) + " M");

  // Nhãn Y (mặt hàng)
  g.selectAll(".yLabel")
    .data(data)
    .enter()
    .append("text")
    .attr("class","yLabel")
    .attr("x",-10)
    .attr("y", d => y(`[${d.maMat}] ${d.tenMat}`)+y.bandwidth()/2+4)
    .attr("text-anchor","end")
    .text(d => `[${d.maMat}] ${d.tenMat}`);

  // Màu đậm hơn
  const color = d3.scaleOrdinal()
    .domain(data.map(d=>d.groupDisplay))
    .range(d3.schemeSet2);

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class","tooltip");

  // Thanh
  const bars = g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class","bar")
    .attr("x",0)
    .attr("y", d => y(`[${d.maMat}] ${d.tenMat}`))
    .attr("width", d => x(d.revenueMil))
    .attr("height", y.bandwidth())
    .attr("rx",4)
    .attr("fill", d => color(d.groupDisplay))
    .on("mouseover", function(evt,d){
      tooltip.style("visibility","visible").html(
        `<b>[${escapeHtml(d.maMat)}] ${escapeHtml(d.tenMat)}</b><br>`+
        `Nhóm hàng: ${escapeHtml(d.groupDisplay)}<br>`+
        `Doanh số bán: ${d3.format(",.0f")(d.revenueMil)} triệu VND<br>`+
        `Số lượng bán: ${d3.format(",.0f")(d.qty)} SKUs`
      );
    })
    .on("mousemove", function(evt){
      tooltip.style("left",(evt.pageX+12)+"px").style("top",(evt.pageY-28)+"px");
    })
    .on("mouseout", ()=> tooltip.style("visibility","hidden"));

  // Value text trên thanh
  g.selectAll(".barValue")
    .data(data)
    .enter()
    .append("text")
    .attr("class","barValue")
    .attr("y", d => y(`[${d.maMat}] ${d.tenMat}`)+y.bandwidth()/2+4)
    .text(d => d3.format(",.0f")(d.revenueMil)+" triệu VND")
    .each(function(d){
      const el = d3.select(this);
      const txt = el.text();
      const txtW = getTextWidth(txt,"12px Arial");
      const barW = x(d.revenueMil);
      if (barW - txtW - 6 > 0) {
        el.attr("x", barW-6).attr("text-anchor","end").style("fill","#fff");
      } else {
        el.attr("x", barW+6).attr("text-anchor","start").style("fill","#000");
      }
    });

  // Tiêu đề
  svg.append("text")
    .attr("x", svgW/2)
    .attr("y", 20)
    .attr("text-anchor","middle")
    .style("font-size","16px")
    .style("font-weight","700")
    .text("Doanh số bán hàng theo mặt hàng");
});

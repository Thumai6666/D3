// Q2.js - Doanh số theo Nhóm hàng (có trục X)
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
  // Gom theo nhóm hàng
  const rolled = d3.rollup(
    raw,
    rows => ({
      revenue: d3.sum(rows, r => parseNumber(r["Thành tiền"])),
      qty: d3.sum(rows, r => parseNumber(r["SL"])),
      groupCode: (rows[0]["Mã nhóm hàng"]||'').trim(),
      groupName: (rows[0]["Tên nhóm hàng"]||'').trim()
    }),
    r => (r["Mã nhóm hàng"]||'').trim()
  );

  let data = Array.from(rolled, ([code,val]) => ({
    groupCode: code || '',
    groupName: val.groupName || '',
    revenueMil: (val.revenue||0)/1e6,
    qty: val.qty||0,
    display: `[${code}] ${val.groupName || ''}`
  })).filter(d=>d.revenueMil>0);

  data.sort((a,b)=> d3.descending(a.revenueMil,b.revenueMil));

  // Layout
  const margin = { top: 40, right: 40, bottom: 70, left: 260 };
  const barHeight = 40;
  const innerHeight = Math.max(1, data.length) * (barHeight + 10);
  const innerWidth = 1100;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  const svg = d3.select("#chart2").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, (d3.max(data,d=>d.revenueMil) || 1) * 1.1])
    .range([0, innerWidth])
    .nice();

  const y = d3.scaleBand()
    .domain(data.map(d => d.display))
    .range([0, innerHeight])
    .padding(0.25);

  // Gridlines (vertical)
  g.append("g")
    .attr("class", "gridlines")
    .selectAll("line")
    .data(x.ticks(6))
    .enter().append("line")
    .attr("x1", d=>x(d))
    .attr("x2", d=>x(d))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#888")
    .attr("stroke-dasharray","3,3")
    .attr("opacity", 0.24);

  // X axis (dưới cùng)
  const xAxis = d3.axisBottom(x)
    .ticks(6)
    .tickFormat(d => d3.format(",.0f")(d) + " M");

  g.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove()) // ẩn đường trục chính nếu muốn gọn
    .selectAll("text")
    .style("font-size","12px");

  // X axis label
  svg.append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", margin.top + innerHeight + 48)
    .attr("text-anchor","middle")
    .style("font-size","13px")
    .style("font-weight","600");

  // Nhãn Y (mặt hàng / nhóm)
  g.selectAll(".yLabel")
    .data(data)
    .enter()
    .append("text")
    .attr("class","yLabel")
    .attr("x",-10)
    .attr("y", d => y(d.display) + y.bandwidth()/2 + 5)
    .attr("text-anchor","end")
    .style("font-size","13px")
    .text(d => d.display);

  // Màu
  const color = d3.scaleOrdinal()
    .domain(data.map(d=>d.groupCode))
    .range(d3.schemeSet2);

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class","tooltip");

  // Thanh
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class","bar")
    .attr("x",0)
    .attr("y", d => y(d.display))
    .attr("width", d => x(d.revenueMil))
    .attr("height", y.bandwidth())
    .attr("rx",6)
    .attr("fill", d => color(d.groupCode))
    .on("mouseover", function(evt,d){
      tooltip.style("visibility","visible").html(
        `<b>${escapeHtml(d.display)}</b><br>
         Doanh số bán: ${d3.format(",.0f")(d.revenueMil)} triệu VND<br>
         Số lượng bán: ${d3.format(",.0f")(d.qty)} SKUs`
      );
    })
    .on("mousemove", function(evt){
      tooltip.style("left",(evt.pageX+12)+"px").style("top",(evt.pageY-28)+"px");
    })
    .on("mouseout", ()=> tooltip.style("visibility","hidden"));

  // Value text trên thanh
  g.selectAll(".barValue")
    .data(data)
    .enter().append("text")
    .attr("class","barValue")
    .attr("y", d => y(d.display) + y.bandwidth()/2 + 5)
    .text(d => d3.format(",.0f")(d.revenueMil) + " triệu VND")
    .each(function(d){
      const el = d3.select(this);
      const txt = el.text();
      const txtW = getTextWidth(txt,"12px Arial");
      const barW = x(d.revenueMil);
      if (barW - txtW - 8 > 0) {
        el.attr("x", barW - 6).attr("text-anchor","end").style("fill","#fff");
      } else {
        el.attr("x", barW + 6).attr("text-anchor","start").style("fill","#000");
      }
    });

  // Tiêu đề
  svg.append("text")
    .attr("x", svgW/2)
    .attr("y", 22)
    .attr("text-anchor","middle")
    .style("font-size","16px")
    .style("font-weight","700")
    .text("Doanh số bán hàng theo Nhóm hàng");
});
